import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAREERS_PATH = ROOT / 'packages' / 'shared' / 'src' / 'data' / 'careers.json'
TALENTS_PATH = ROOT / 'packages' / 'shared' / 'src' / 'data' / 'talents.json'

ALLOWED = ["WS","BS","S","T","I","Agi","Dex","Int","WP","Fel"]
ALLOWED_SET = set(ALLOWED)
PREFERRED_ORDER = ALLOWED[:]  # order to pick new attributes from


def normalize_token(tok: str) -> str:
    if not tok or not isinstance(tok, str):
        return tok
    t = tok.strip()
    # common normalizations
    t = t.replace('Agility','Agi')
    t = t.replace('Ag','Agi')
    t = t.replace('Agi.','Agi')
    # unify case: attempt to match allowed tokens ignoring case
    for a in ALLOWED:
        if t.lower() == a.lower():
            return a
    # fallback: uppercase letters except keep case for 'Agi' 'Dex' etc
    return t


def normalize_characteristics(levels):
    # levels: list of dicts sorted by lvl
    prev = []
    for i, lvl in enumerate(levels):
        expected_len = 3 + i  # lvl1 ->3, lvl2->4, lvl3->5, lvl4->6
        chars = lvl.get('characteristic_advances', [])
        # normalize tokens
        chars_norm = []
        for c in chars:
            cn = normalize_token(c)
            if cn not in chars_norm:
                chars_norm.append(cn)
        # ensure prev included
        for p in prev:
            if p not in chars_norm:
                chars_norm.append(p)
        # if too short, append from preferred order
        for cand in PREFERRED_ORDER:
            if len(chars_norm) >= expected_len:
                break
            if cand not in chars_norm:
                chars_norm.append(cand)
        # if too long, trim while ensuring prev stays
        if len(chars_norm) > expected_len:
            # keep any in prev and then the first ones
            newlist = []
            for x in chars_norm:
                if x in prev and x not in newlist:
                    newlist.append(x)
            for x in chars_norm:
                if x not in newlist and len(newlist) < expected_len:
                    newlist.append(x)
            chars_norm = newlist
        # final sanitize: ensure all in ALLOWED_SET else drop
        chars_norm = [c for c in chars_norm if c in ALLOWED_SET]
        # if removal made it short, top up
        for cand in PREFERRED_ORDER:
            if len(chars_norm) >= expected_len:
                break
            if cand not in chars_norm:
                chars_norm.append(cand)
        lvl['characteristic_advances'] = chars_norm
        prev = list(chars_norm)
    return levels


def normalize_name_to_snake(s: str) -> str:
    # Turn a display name like 'Read/Write' or 'Lore (Chemistry)' into snake_case like 'read_write' or 'lore_chemistry'
    if not s or not isinstance(s, str):
        return s
    # extract parenthetical
    m = re.match(r"^\s*(.*?)\s*(?:\((.*?)\))?\s*$", s)
    if not m:
        base = s
        par = None
    else:
        base = m.group(1)
        par = m.group(2)
    # convert base to ascii, lowercase and replace non-alnum with underscore
    base_snake = re.sub(r"[^0-9a-zA-Z]+", '-', base).strip('-').lower()
    if par:
        par_snake = re.sub(r"[^0-9a-zA-Z]+", '', par).strip('-').lower()
        return f"{base_snake}_{par_snake}"
    return base_snake


def build_talent_map():
    # map normalized display names to talent id (from talents.json)
    data = json.loads(TALENTS_PATH.read_text())
    mp = {}
    for t in data:
        name = t.get('name')
        tid = t.get('id')
        if not name or not tid:
            continue
        key = re.sub(r"[^0-9a-zA-Z]+", '-', name).strip('-').lower()
        # store id converted to snake_case (replace '-' with '_')
        mp[key] = tid
        # also store a version without parenthetical if name had parentheses
        m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", name)
        if m:
            base = m.group(1).strip()
            basekey = re.sub(r"[^0-9a-zA-Z]+", '-', base).strip('-').lower()
            # map base alone to base id if base differs
            if basekey not in mp:
                mp[basekey] = tid
    return mp


def map_talent_display_to_id(display: str, talent_map):
    # If display contains parentheses we need to append the inner content after the mapped id
    if not display or not isinstance(display, str):
        return display
    m = re.match(r"^\s*(.*?)\s*(?:\((.*?)\))?\s*$", display)
    if not m:
        base = display
        par = None
    else:
        base = m.group(1)
        par = m.group(2)
    key = re.sub(r"[^0-9a-zA-Z]+", '-', base).strip('-').lower()
    base_id = talent_map.get(key)
    if base_id:
        if par:
            par_snake = re.sub(r"[^0-9a-zA-Z]+", '-', par).strip('-').lower()
            return f"{base_id}_{par_snake}"
        return base_id
    # fallback: build from original display
    print(f"Warning: talent display name '{key}' not found in talent map.")
    return normalize_name_to_snake(display)


def process_careers():
    careers = json.loads(CAREERS_PATH.read_text())
    talent_map = build_talent_map()
    changed = 0
    for career in careers:
        if 'career_level' not in career or not isinstance(career['career_level'], list):
            continue
        # sort by lvl
        career['career_level'].sort(key=lambda x: x.get('lvl', 0))
        levels = career['career_level']
        # enforce exactly 4 levels
        if len(levels) < 4:
            # clone the last level with incremented lvl and adjusted id/name
            while len(levels) < 4:
                last = levels[-1]
                new = json.loads(json.dumps(last))
                new_lvl = last.get('lvl', len(levels)) + 1
                new['lvl'] = new_lvl
                # adjust id and name (append level number)
                new['id'] = f"{last.get('id', 'level')}-lvl{new_lvl}"
                new['name'] = f"{last.get('name', 'Level')} {new_lvl}"
                levels.append(new)
                changed += 1
        elif len(levels) > 4:
            # trim to first 4
            career['career_level'] = levels[:4]
            levels = career['career_level']
            changed += 1
        # normalize characteristics progression
        career['career_level'] = normalize_characteristics(career['career_level'])
        # map talent_ids and skills_ids
        for lvl in career['career_level']:
            # talents
            tlist = lvl.get('talent_ids', [])
            new_t = []
            for t in tlist:
                mapped = map_talent_display_to_id(t, talent_map)
                if mapped not in new_t:
                    new_t.append(mapped)
            if new_t != tlist:
                lvl['talent_ids'] = new_t
                changed += 1
            # skills
            slist = lvl.get('skills_ids', [])
            new_s = []
            for s in slist:
                mapped = normalize_name_to_snake(s)
                if mapped not in new_s:
                    new_s.append(mapped)
            if new_s != slist:
                lvl['skills_ids'] = new_s
                changed += 1
    # write back
    CAREERS_PATH.write_text(json.dumps(careers, indent=4, ensure_ascii=False))
    print(f"Processed {len(careers)} careers, applied ~{changed} modifications.")


if __name__ == '__main__':
    process_careers()
