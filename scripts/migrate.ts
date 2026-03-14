// scripts/migrate.ts
import { getDB } from "../src/libs/surreal";

async function migrate() {
    console.log("Applying schema...");
    const db = await getDB();
    console.log("Schema applied successfully");
    process.exit(0);
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});