import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { DB } from "../_worker";
import type { Env } from "../db/db";
import { setup } from "../setup";

function buf2hex(buffer: ArrayBuffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export const StorageService = (db: DB, env: Env) => {
    const region = env.S3_REGION;
    const endpoint = env.S3_ENDPOINT;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const bucket = env.S3_BUCKET;
    const folder = env.S3_FOLDER || '';
    const s3 = new S3Client({
        region: region,
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey
        }
    });
    return new Elysia({ aot: false })
        .use(setup(db, env))
        .group('/storage', (group) =>
            group
                .post('/', async ({ uid, set, body: { key, file } }) => {

                    if (!endpoint) {
                        set.status = 500;
                        return 'S3_ENDPOINT is not defined'
                    }
                    if (!accessKeyId) {
                        set.status = 500;
                        return 'S3_ACCESS_KEY_ID is not defined'
                    }
                    if (!secretAccessKey) {
                        set.status = 500;
                        return 'S3_SECRET_ACCESS_KEY is not defined'
                    }
                    if (!bucket) {
                        set.status = 500;
                        return 'S3_BUCKET is not defined'
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const suffix = key.includes(".") ? key.split('.').pop() : "";
                    const hashArray = await crypto.subtle.digest(
                        { name: 'SHA-1' },
                        await file.arrayBuffer()
                    );
                    const hash = buf2hex(hashArray)
                    const hashkey = path.join(folder, hash + "." + suffix);
                    try {
                        const response = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hashkey, Body: file }))
                        console.info(response);
                        return `${accessHost}/${hashkey}`
                    } catch (e: any) {
                        set.status = 400;
                        console.error(e.message)
                        return e.message
                    }
                }, {
                    body: t.Object({
                        key: t.String(),
                        file: t.File()
                    })
                })
        );
}