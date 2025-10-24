import { HashRouter, Routes, Route } from 'react-router-dom';
import GmApp from './GmApp';
import PlayerApp from './PlayerApp';
import { allSkillsAndCharacteristics } from '@wfrp/shared';

function App() {
  
  console.log("Welcome GM")

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GmApp />} />
        <Route path="/player" element={<PlayerApp />} />
      </Routes>
    </HashRouter>
  );
}
export default App;