import { Client, Databases, Users, ID, Query } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);

  // Parse Payload
  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (err) {
    return res.json({ success: false, error: "Invalid JSON" });
  }

  const { email, name } = payload;
  // Note: This uses Server Time (UTC). Consider hardcoding 'en-US' with timeZone: 'America/Phoenix' if needed.
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' });
  
  const DB_ID = '697e7098000a1a51bb73';
  const RSVP_COLLECTION = 'rsvp';

  try {
    const result = await databases.listDocuments(DB_ID, RSVP_COLLECTION, [
      Query.equal('email', email)
    ]);

    let userName = name; 
    let finalStatus = 'checkin_existing';

    if (result.total > 0) {
      // === RETURNING PLAYER (FAST PATH) ===
      const doc = result.documents[0];
      userName = doc.name;
      
      if (doc.attendance_log && doc.attendance_log.includes(today)) {
        return res.json({ success: true, status: 'already_checked_in', name: userName });
      }
      
      const newLog = doc.attendance_log ? [...doc.attendance_log, today] : [today];
      await databases.updateDocument(DB_ID, RSVP_COLLECTION, doc.$id, { attendance_log: newLog });
      
    } else {
      // === NEW PLAYER (SLOW PATH - Runs Once) ===
      if (!name) return res.json({ success: false, status: 'needs_name' });
      
      // 1. Create DB Record
      await databases.createDocument(DB_ID, RSVP_COLLECTION, ID.unique(), {
          email, name, attendance_log: [today], can_reserve: false, is_member: false
      });
      finalStatus = 'checkin_new';

      // 2. Create Auth Account (MOVED HERE)
      // We only try this if we know they are new to the system.
      try {
        await users.create(ID.unique(), email, undefined, 'Pickleball2026!', userName);
      } catch (err) {
        // Ignore errors if account exists
      }
    }

    return res.json({ success: true, status: finalStatus, name: userName });

  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
};
