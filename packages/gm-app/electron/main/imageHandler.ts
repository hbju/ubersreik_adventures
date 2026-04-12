import { dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { supabase as supabaseModule } from '@wfrp/shared';
import { isSupabaseInitialized } from './supabaseManager';

const STORAGE_BUCKET = 'character-images';

/**
 * Get the base directory for character images in user data (local fallback)
 */
function getCharacterImagesDir(): string {
    const dir = path.join(app.getPath('userData'), 'images', 'characters');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (not a full URL).
 */
async function uploadToSupabaseStorage(filePath: string, storagePath: string): Promise<string> {
    const sb = supabaseModule.getSupabase();
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
    };
    const contentType = mimeMap[ext] || 'image/png';

    const { data, error } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, { contentType, upsert: true });
    if (error) throw error;
    return data.path;
}

/**
 * Get a signed URL for a character image from Supabase Storage.
 */
async function getSignedUrl(storagePath: string): Promise<string | null> {
    const sb = supabaseModule.getSupabase();
    const { data, error } = await sb.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour
    if (error) return null;
    return data.signedUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
async function deleteFromSupabaseStorage(storagePath: string): Promise<void> {
    const sb = supabaseModule.getSupabase();
    await sb.storage.from(STORAGE_BUCKET).remove([storagePath]);
}

/**
 * Open a file dialog to select an image file, upload it to Supabase Storage
 * (or copy locally as fallback), and return the path/URL.
 */
export async function selectAndCopyCharacterImage(characterId: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        title: 'Select Character Image',
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
        ],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath);

    // Try Supabase Storage first
    if (isSupabaseInitialized()) {
        try {
            const storagePath = `${characterId}${ext}`;
            await uploadToSupabaseStorage(sourcePath, storagePath);
            return `supabase://${storagePath}`;
        } catch (err) {
            console.warn('[IMAGE] Supabase Storage upload failed, falling back to local:', err);
        }
    }

    // Local fallback
    const destDir = getCharacterImagesDir();
    const destFileName = `${characterId}${ext}`;
    const destPath = path.join(destDir, destFileName);

    // Remove any existing image for this character (different extension)
    const existingFiles = fs.readdirSync(destDir).filter(f => f.startsWith(characterId));
    for (const existingFile of existingFiles) {
        fs.unlinkSync(path.join(destDir, existingFile));
    }

    fs.copyFileSync(sourcePath, destPath);
    return destPath;
}

/**
 * Get the absolute path to a character's image if it exists
 */
export function getCharacterImagePath(characterId: string): string | null {
    const dir = getCharacterImagesDir();
    const files = fs.readdirSync(dir).filter(f => f.startsWith(characterId));
    if (files.length > 0) {
        return path.join(dir, files[0]);
    }
    return null;
}

/**
 * Delete a character's image file (from Supabase Storage and/or local)
 */
export async function deleteCharacterImage(characterId: string): Promise<void> {
    // Try deleting from Supabase Storage
    if (isSupabaseInitialized()) {
        try {
            const sb = supabaseModule.getSupabase();
            const { data: files } = await sb.storage.from(STORAGE_BUCKET).list('', {
                search: characterId,
            });
            if (files && files.length > 0) {
                await sb.storage.from(STORAGE_BUCKET).remove(files.map(f => f.name));
            }
        } catch (err) {
            console.warn('[IMAGE] Error deleting from Supabase Storage:', err);
        }
    }

    // Delete local copies too
    const dir = getCharacterImagesDir();
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.startsWith(characterId));
    for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
    }
}

/**
 * Read a character image as a base64 data URL.
 * Supports Supabase Storage paths (supabase://...) and local file paths.
 */
export async function readCharacterImageAsDataUrl(imagePath: string): Promise<string | null> {
    try {
        // Handle Supabase Storage paths
        if (imagePath.startsWith('supabase://')) {
            const storagePath = imagePath.replace('supabase://', '');
            const signedUrl = await getSignedUrl(storagePath);
            return signedUrl; // Return the URL directly instead of base64
        }

        // Local file
        if (!fs.existsSync(imagePath)) return null;
        const ext = path.extname(imagePath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
        };
        const mime = mimeMap[ext] || 'image/png';
        const data = fs.readFileSync(imagePath);
        return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
        return null;
    }
}
