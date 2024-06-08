import { PutObjectCommand } from "@aws-sdk/client-s3";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Feed } from "feed";
import path from 'path';
import type { Env } from "../db/db";
import * as schema from "../db/schema";
import { feeds, users } from "../db/schema";
import { extractImage } from "../utils/image";
import { createS3Client } from "../utils/s3";


export async function rssCrontab(env: Env) {
    const frontendUrl = env.FRONTEND_URL;
    const db = drizzle(env.DB, { schema: schema })
    let title = env.RSS_TITLE;
    const description = env.RSS_DESCRIPTION || "Feed from Rin";
    if (!title) {
        const user = await db.query.users.findFirst({ where: eq(users.id, 1) });
        if (!user) {
            return;
        }
        title = user.username;
    }
    const feed = new Feed({
        title: title,
        description: description,
        id: frontendUrl,
        link: frontendUrl,
        favicon: `${frontendUrl}/favicon.png`,
        copyright: "All rights reserved 2024",
        updated: new Date(), // optional, default = today
        generator: "Feed from Rin", // optional, default = 'Feed for Node.js'
        feedLinks: {
            rss: `${frontendUrl}/sub/rss.xml`,
            json: `${frontendUrl}/sub/rss.json`,
            atom: `${frontendUrl}/sub/atom.xml`
        }
    });
    const feed_list = await db.query.feeds.findMany({
        where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: 20,
        with: {
            user: {
                columns: { id: true, username: true, avatar: true }
            }
        }
    });
    feed_list.forEach(({ summary, content, user, ...other }) => {
        feed.addItem({
            title: other.title || "No title",
            id: other.id?.toString() || "0",
            link: `${frontendUrl}/feed/${other.id}`,
            date: other.createdAt,
            description: summary.length > 0 ? summary : content.length > 100 ? content.slice(0, 100) : content,
            content: content,
            author: [{ name: user.username }],
            image: extractImage(content) || user.avatar as string,
        });
    });
    // save rss.xml to s3
    const bucket = env.S3_BUCKET;
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    const s3 = createS3Client(env);
    async function save(name: string, data: string) {
        const hashkey = path.join(folder, name);
        try {
            await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hashkey, Body: data }))
        } catch (e: any) {
            console.error(e.message)
        }
    }
    await save('rss.xml', feed.rss2());
    await save('atom.xml', feed.atom1());
    await save('rss.json', feed.json1());
}
