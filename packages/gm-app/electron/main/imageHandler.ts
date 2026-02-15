import { dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the base directory for character images in user data
 */
function getCharacterImagesDir(): string {
    const dir = path.join(app.getPath('userData'), 'images', 'characters');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * Open a file dialog to select an image file, copy it to the app's
 * user data folder, and return the destination path.
 * 
 * @param characterId The character ID to associate the image with
 * @returns The absolute path to the copied image, or null if cancelled
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
    const destDir = getCharacterImagesDir();
    const destFileName = `${characterId}${ext}`;
    const destPath = path.join(destDir, destFileName);

    // Remove any existing image for this character (different extension)
    const existingFiles = fs.readdirSync(destDir).filter(f => f.startsWith(characterId));
    for (const existingFile of existingFiles) {
        fs.unlinkSync(path.join(destDir, existingFile));
    }

    // Copy the file
    fs.copyFileSync(sourcePath, destPath);

    return destPath;
}

/**
 * Get the absolute path to a character's image if it exists
 * 
 * @param characterId The character ID
 * @returns The absolute path to the image file, or null if not found
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
 * Delete a character's image file
 * 
 * @param characterId The character ID
 */
export function deleteCharacterImage(characterId: string): void {
    const dir = getCharacterImagesDir();
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.startsWith(characterId));
    for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
    }
}

/**
 * Read a character image as a base64 data URL
 * 
 * @param imagePath The absolute path to the image
 * @returns The base64 data URL string, or null if not readable
 */
export function readCharacterImageAsDataUrl(imagePath: string): string | null {
    try {
        if (!fs.existsSync(imagePath)) return null;
        const ext = path.extname(imagePath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp'
        };
        const mime = mimeMap[ext] || 'image/png';
        const data = fs.readFileSync(imagePath);
        return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
        return null;
    }
}
