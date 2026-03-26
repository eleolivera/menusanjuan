import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname2 = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname2, "../../.env") });

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});
const BUCKET = process.env.R2_BUCKET || "menusanjuan-images";

const FOLDER = "/Users/eleolivera/Downloads/puerto pachata images";

// Mapped in order: DB item # → filename
const ITEMS = [
  { id: "cmn6vg89y000b04lg4wlutdti", file: "social_u7245613316_httpss.mj.runPFlo0jIksk0_ultra-realistic_cinemati_ba4c2948-bc6d-4b4e-a985-16fc473d3943_0 (1).mp4" },
  { id: "cmn6vg8or000c04lgi8fdalcr", file: "u7245613316_Improve_the_photo_lighting_and_colors_while_keepi_93c6b313-c018-4597-b0d3-8b1f7cfaf208_3 (1).png" },
  { id: "cmn6vg93t000d04lgc5jiorga", file: "social_u7245613316_httpss.mj.runZ2wZpxOcrwY_cinematic_close-up_of_an_977ec756-165a-4b3b-9714-86be97eb256c_3 (1).mp4" },
  { id: "cmn6vg9ie000e04lg84nqwo5f", file: "u7245613316_fix_the_background_smoke_--ar_32_--v_6.1_2f160baf-adef-44a6-8e53-47acd2fe5a3e_2 (2).png" },
  { id: "cmn6vg9wp000f04lgg7i7gesp", file: "social_u7245613316_httpss.mj.runEQbUcl9ZLj0_hyper-realistic_cinemati_26f8ffce-8f49-454c-9d23-9f83d4b59e44_0 (1).mp4" },
  { id: "cmn6vgabm000g04lgn22udzoc", file: "social_u7245613316_httpss.mj.runEQbUcl9ZLj0_hyper-realistic_cinemati_26f8ffce-8f49-454c-9d23-9f83d4b59e44_0 (2).mp4" },
  { id: "cmn6vgaq3000h04lgy7j1pk0l", file: "u7245613316_fix_the_background_smoke_--ar_32_--v_6.1_2f160baf-adef-44a6-8e53-47acd2fe5a3e_2 (3).png" },
  { id: "cmn6vgb4x000i04lg7qswm2d3", file: "social_u7245613316_httpss.mj.runUTXFUFK0_7k_cinematic_close-up_of_an_eef11534-e08c-4034-8e40-e2a8122e3039_2 (1).mp4" },
  { id: "cmn6vgbjk000j04lggz4ypnyd", file: "papas fritas .jpeg" },
  { id: "cmn6vgbxt000k04lgnffi5ij0", file: "papas fri.jpeg" },
  { id: "cmn6vgcce000l04lgqm3ntgw7", file: "mayo de ajo.jpeg" },
];

async function main() {
  console.log("🍽️ Uploading Puerto Pachatas menu images/videos to R2...\n");

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, file } = ITEMS[i];
    const filePath = path.join(FOLDER, file);

    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ File not found: ${file}`);
      continue;
    }

    const ext = file.split(".").pop()?.toLowerCase() || "jpg";
    const contentType = ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : "image/jpeg";
    const key = `puerto-pachatas/menu-item-${i + 1}.${ext}`;

    const buffer = fs.readFileSync(filePath);

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const url = `https://images.menusanjuan.com/${key}`;

    await prisma.menuItem.update({
      where: { id },
      data: { imageUrl: url },
    });

    const item = await prisma.menuItem.findUnique({ where: { id }, select: { name: true } });
    console.log(`   ✅ ${(i + 1).toString().padStart(2)}. ${item?.name?.padEnd(30)} → ${key}`);
  }

  console.log("\n✅ Done! All images/videos uploaded to R2 and linked to menu items.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
