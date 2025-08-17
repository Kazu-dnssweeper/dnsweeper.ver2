import fs from 'node:fs';
export async function detectEncoding(file) {
    const fd = await fs.promises.open(file, 'r');
    try {
        const buf = Buffer.alloc(3);
        const { bytesRead } = await fd.read(buf, 0, 3, 0);
        if (bytesRead >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
            return 'utf8-bom';
        return 'utf8';
    }
    finally {
        await fd.close();
    }
}
//# sourceMappingURL=detect.js.map