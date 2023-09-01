import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection} from '@capacitor-community/sqlite';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonicModule],
})
export class HomePage {
  constructor() {}

  async ionViewDidEnter() {
    // Plugin Initialization
    const platform = Capacitor.getPlatform();
    const sqlitePlugin = CapacitorSQLite;
    const sqliteConnection = new SQLiteConnection(sqlitePlugin);

    // Open a Database
    const openDatabase = async (dbName:string, encrypted: boolean,
                      mode: string, version: number,
                      readonly: boolean): Promise<SQLiteDBConnection> => {
      let db: SQLiteDBConnection;
      // Check connections consistency
      const retCC = (await sqliteConnection.checkConnectionsConsistency()).result;
      // Check if a connection exists for the database dbName
      const isConn = (await sqliteConnection.isConnection(dbName, readonly)).result;
      if(retCC && isConn) {
        // Retrieve the existing connection
        db = await sqliteConnection.retrieveConnection(dbName, readonly);
      } else {
        // Create a new connection
        db = await sqliteConnection
                  .createConnection(dbName, encrypted, mode, version, readonly);
      }
      await db.open();
      return db;
    }
    const deleteDatabase = async( db: SQLiteDBConnection): Promise<void> => {
      if((await db.isExists()).result) {
        await db.delete()
      }
      return;
    }

    // ************************************************
    // Create Database No Encryption
    // ************************************************

    // Open testEncryption database not encrypted
    // encrypted: false
    // mode: "no-encryption"

    const db = await openDatabase("testEncryption",false, "no-encryption",
                                  1, false);

    const createSchema: string = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        age FLOAT,
        sql_deleted BOOLEAN DEFAULT 0 CHECK (sql_deleted IN (0, 1)),
        last_modified INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS users_index_email ON users (email);
      CREATE INDEX IF NOT EXISTS users_index_last_modified ON users (last_modified);
      CREATE TRIGGER IF NOT EXISTS users_trigger_last_modified
      AFTER UPDATE ON users
      FOR EACH ROW WHEN NEW.last_modified <= OLD.last_modified
      BEGIN
        UPDATE users SET last_modified= (strftime('%s', 'now')) WHERE id=NEW.id;
      END;
      CREATE VIEW IF NOT EXISTS v_users_email AS SELECT email FROM users;
      CREATE VIEW IF NOT EXISTS v_users_name AS SELECT name, age FROM users;

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        age FLOAT,
        sql_deleted BOOLEAN DEFAULT 0 CHECK (sql_deleted IN (0, 1)),
        last_modified INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS contacts_index_email ON contacts (email);
      CREATE INDEX IF NOT EXISTS contacts_index_last_modified ON contacts (last_modified);
      CREATE TRIGGER IF NOT EXISTS contacts_trigger_last_modified
      AFTER UPDATE ON contacts
      FOR EACH ROW WHEN NEW.last_modified <= OLD.last_modified
      BEGIN
        UPDATE contacts SET last_modified= (strftime('%s', 'now')) WHERE id=NEW.id;
      END;
      CREATE VIEW IF NOT EXISTS v_contacts_email AS SELECT email FROM contacts;
      CREATE VIEW IF NOT EXISTS v_contacts_name AS SELECT name, age FROM contacts;
    `;
    // create tables in db
    let ret: any = await db.execute(createSchema);
    if (ret.changes.changes < 0) {
      console.log("Execute createSchema failed");
    }

    // Create two users
    const twoUsers: string = `
    INSERT INTO users (name,email,age) VALUES ('Whiteley','Whiteley.com',30.4), ('Jones','Jones.com',44.9);`;
    ret = await db.execute(twoUsers, true, true);
    if (ret.changes.changes !== 2) {
      console.log("Execute twoUsers failed");
    }
    // Query all users
    ret = await db.query("SELECT name,age FROM users;");
    console.log(`ret.values: ${JSON.stringify(ret.values)}`)
    if(ret.values.length !== 2 || ret.values[0].name !== "Whiteley" ||
                                  ret.values[1].name !== "Jones") {
      console.log("Query1 twoUsers failed");
    }
    // Create two users
    const twoContacts: string = `
    INSERT INTO contacts (name,email,age) VALUES ('Whiteley','Whiteley.com',30.4), ('Jones','Jones.com',44.9);`;
    ret = await db.execute(twoContacts, true, true);
    if (ret.changes.changes !== 2) {
      console.log("Execute twoUsers failed");
    }
    // Query all users
    ret = await db.query("SELECT name,age FROM contacts;");
    console.log(`ret.values: ${JSON.stringify(ret.values)}`)
    if(ret.values.length !== 2 || ret.values[0].name !== "Whiteley" ||
                                  ret.values[1].name !== "Jones") {
      console.log("Query1 twoContacts failed");
    }
    // ************************************************
    // Full Export JSON Object
    // ************************************************
    let jsonObj: any = await db.exportToJson('full');
    console.log(`returned JSONObject: `, jsonObj);

    // delete the database
    await deleteDatabase(db);
    // Close the connection
    await sqliteConnection.closeConnection("testEncryption", false);

    // ************************************************
    // Full Import JSON Object
    // ************************************************
    let result: any = await sqliteConnection
          .importFromJson(JSON.stringify(jsonObj.export));
    if(result.changes.changes === -1 ) console.log("ImportFromJson 'full' jsonObj failed");
    console.log(`**** After Full Import **** ${JSON.stringify(result)}`)

    // Open testEncryption database after import from jsonObj
    const db1 = await openDatabase("testEncryption",false, "no-encryption",
                                    1, false);
    // Query all users
    const retQU = await db1.query("SELECT * FROM users;");
    if(retQU.values && retQU.values.length !== 2 || retQU.values![0].name !== "Whiteley" ||
                                  retQU.values![1].name !== "Jones") {
      console.log("Query1-Import twoUsers failed");
    }
    // Query all contacts
    const retQC = await db1.query("SELECT * FROM contacts;");
    if(retQC.values && retQC.values.length !== 2 || retQC.values![0].name !== "Whiteley" ||
                                  retQC.values![1].name !== "Jones") {
      console.log("Query1-Import twoContacts failed");
    }

    // Close the connection
    await sqliteConnection.closeConnection("testEncryption", false);

    // ************************************************
    // Encrypt the existing database
    // encrypted: true
    // mode: "encryption"
    // ************************************************

    // Check if platform allow for encryption
    const isPlatformEncryption = platform === 'web' ? false : true;
    // Check if isEncryption in the capacitor.config.ts
    const isEncryptInConfig = (await sqliteConnection.isInConfigEncryption()).result
    // Define isEncryption
    const isEncryption = isPlatformEncryption && isEncryptInConfig ? true : false;
console.log(`@@@ isPlatformEncryption: ${isPlatformEncryption}`)
console.log(`@@@ isEncryptInConfig: ${isEncryptInConfig}`)
console.log(`@@@ isEncryption: ${isEncryption}`)
    //
    if(isEncryption) {
      // check if a passphrase has been stored
      const isSetPassphrase = (await sqliteConnection.isSecretStored()).result;
console.log(`@@@ isSetPassphrase: ${isSetPassphrase}`)

      if(!isSetPassphrase) {
        // Set a Passphrase
        const passphrase = "YOUR_PASSPHRASE";
        await sqliteConnection.setEncryptionSecret(passphrase);
console.log(`@@@ after setEncryptionSecret with: ${passphrase}`)
      }

      // Open testEncryption database and encrypt it
      const db = await openDatabase("testEncryption",true, "encryption",
                              1, false);
      // Check if database testEncryption is encrypted
      if((await sqliteConnection.isDatabase("testEncryption")).result)  {
        const isDBEncrypted = (await sqliteConnection.isDatabaseEncrypted("testEncryption")).result;
        if(!isDBEncrypted) {
          console.log('Error database "testEncryption" is not encrypted')
        }
        // Query all users
        const ret = await db.query("SELECT * FROM users;");
        if(ret.values && ret.values.length !== 2 || ret.values![0].name !== "Whiteley" ||
                                      ret.values![1].name !== "Jones") {
          console.log("Query2 twoUsers failed");
        }

        // ************************************************
        // Full Export UnEncrypted JSON Object
        // ************************************************
        console.log(`@@@ before exportToJson full unencrypted `)
        let unJsonObj: any = await db.exportToJson('full');
        console.log(`returned unencrypted JSONObject: ${JSON.stringify(unJsonObj.export)}`);

        // ************************************************
        // Full Export Encrypted JSON Object
        // ************************************************
        console.log(`@@@ before exportToJson full encrypted `)
//        let jsonObj: any = await db.exportToJson('full',true);
        let jsonObj: any = await db.exportToJson('full',true);
        console.log(`returned encryptedJSONObject: ${JSON.stringify(jsonObj.export)}`);

        // delete the database
        await deleteDatabase(db);
        // Close the connection
        await sqliteConnection.closeConnection("testEncryption", false);

        // ************************************************
        // Full Import Encrypted JSON Object
        // ************************************************

        console.log("***************************************")
        console.log("** Full Import Encrypted JSON Object **")
        console.log("***************************************")
        console.log(`### JSONOBJ ${JSON.stringify(jsonObj.export)}`)
        let result: any = await sqliteConnection
              .importFromJson(JSON.stringify(jsonObj.export));
        if(result.changes.changes === -1 ) console.log("ImportFromJson 'full' encrypted jsonObj failed");

        // Open testEncryption database after import from jsonObj
        const db1 = await openDatabase("testEncryption",true, "secret",
                              1, false);
        // Query all users
        const retQ = await db1.query("SELECT * FROM users;");
        if(retQ.values && retQ.values.length !== 2 || retQ.values![0].name !== "Whiteley" ||
                                      retQ.values![1].name !== "Jones") {
          console.log("Query3 twoUsers failed");
        }

      }
      // Close the connection
      await sqliteConnection.closeConnection("testEncryption", false);
    }
    // ************************************************
    // Encrypt the new database
    // encrypted: true
    // mode: "secret"
    // ************************************************

    //
    if(isEncryption) {
      // check if a passphrase has been stored
      const isSetPassphrase = (await sqliteConnection.isSecretStored()).result;
      if(!isSetPassphrase) {
        // Set a Passphrase
        const passphrase = "YOUR_PASSPHRASE";
        await sqliteConnection.setEncryptionSecret(passphrase);
      }
      // Open testNewEncryption database
      const db = await openDatabase("testNewEncryption",true, "secret",
                                  1, false);

      const createSchema: string = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY NOT NULL,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          age INTEGER);
      `;
      // create tables in db
      let ret: any = await db.execute(createSchema);
      if (ret.changes.changes < 0) {
        console.log("Execute createSchema failed");
      }
      // Create two users
      const twoUsers: string = `
      INSERT INTO users (name,email,age) VALUES ('Whiteley','Whiteley.com',30), ('Jones','Jones.com',44);`;
      ret = await db.execute(twoUsers, true, true);
      if (ret.changes.changes !== 2) {
        console.log("Execute twoUsers failed");
      }
      // Query all users
      ret = await db.query("SELECT * FROM users;");
      if(ret.values.length !== 2 || ret.values[0].name !== "Whiteley" ||
                                    ret.values[1].name !== "Jones") {
        console.log("Query3 twoUsers failed");
      }
      // Close the connection
      await sqliteConnection.closeConnection("testNewEncryption", false);


    }
  }
}
