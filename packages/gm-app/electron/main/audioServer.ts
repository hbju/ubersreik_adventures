import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

let audioServer: http.Server | null = null;
let serverPort = 0;

const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
};

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'audio/mpeg';
}

export function startAudioServer(): Promise<number> {
    return new Promise((resolve, reject) => {
        audioServer = http.createServer(async (req, res) => {
            if (!req.url) {
                res.writeHead(400);
                res.end('Bad Request');
                return;
            }

            try {
                const filePath = decodeURIComponent(req.url.slice(1));
                
                const stat = await fs.promises.stat(filePath);
                const fileSize = stat.size;
                const mimeType = getMimeType(filePath);
                const range = req.headers.range;

                if (range) {
                    const match = range.match(/bytes=(\d+)-(\d*)/);
                    if (match) {
                        const start = parseInt(match[1], 10);
                        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
                        
                        if (start >= fileSize) {
                            res.writeHead(416, {
                                'Content-Range': `bytes */${fileSize}`,
                            });
                            res.end();
                            return;
                        }

                        const validEnd = Math.min(end, fileSize - 1);
                        const chunkSize = validEnd - start + 1;

                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${validEnd}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': chunkSize,
                            'Content-Type': mimeType,
                        });

                        const stream = fs.createReadStream(filePath, { start, end: validEnd });
                        stream.pipe(res);
                        return;
                    }
                }

                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                });

                const stream = fs.createReadStream(filePath);
                stream.pipe(res);

            } catch (error) {
                console.error('Audio server error:', error);
                res.writeHead(404);
                res.end('File not found');
            }
        });

        audioServer.listen(0, '127.0.0.1', () => {
            const address = audioServer!.address();
            if (address && typeof address === 'object') {
                serverPort = address.port;
                console.log(`Audio server started on port ${serverPort}`);
                resolve(serverPort);
            } else {
                reject(new Error('Failed to get server port'));
            }
        });

        audioServer.on('error', reject);
    });
}

export function getAudioServerPort(): number {
    return serverPort;
}

export function stopAudioServer(): void {
    if (audioServer) {
        audioServer.close();
        audioServer = null;
    }
}