const knex = require("knex");
const path = require("path");

const DB_PATH = process.env.GITLOBSTER_STORAGE_DIR
  ? path.resolve(
      process.env.GITLOBSTER_STORAGE_DIR,
      process.env.GITLOBSTER_DB_FILE || "registry.sqlite",
    )
  : path.join(__dirname, "../../storage/registry.sqlite");

const db = knex({
  client: "sqlite3",
  connection: { filename: DB_PATH },
  useNullAsDefault: true,
});

module.exports = db;
