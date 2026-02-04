import { Client, Databases, Query, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // 1. Initialize the Appwrite Client
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const db = new Databases(client);
  const DB_ID = '697e7098000a1a51bb73'; // Your Database ID
  const COLL_ID = 'rsvp';              // Your Collection ID

  try {
    // 2. Parse the data coming from the website
    const { name, email, rsvp_date, can_reserve, is_member } = JSON.parse(req.body);

    if (!email) {
      return res.json({ error: 'Email is required' }, 400);
    }

    // 3. Search for the user by Email
    const existing = await db.listDocuments(DB_ID, COLL_ID, [
      Query.equal('email', email)
    ]);

    if (existing.total > 0) {
      // --- PLAYER EXISTS: UPDATE THEM ---
      const doc = existing.documents[0];
      const currentLog = doc.attendance_log || [];

      // Only add the date if it's not already there
      if (!currentLog.includes(rsvp_date)) {
        const newLog = [...currentLog, rsvp_date];
        
        await db.updateDocument(DB_ID, COLL_ID, doc.$id, {
          attendance_log: newLog,
          can_reserve: can_reserve,
          is_member: is_member
        });
        log(`Updated existing player: ${email}`);
      }
      return res.json({ status: 'updated', id: doc.$id });

    } else {
      // --- NEW PLAYER: CREATE THEM ---
      const newDoc = await db.createDocument(DB_ID, COLL_ID, ID.unique(), {
        name: name,
        email: email,
        attendance_log: [rsvp_date],
        can_reserve: can_reserve,
        is_member: is_member
      });
      log(`Created new player: ${email}`);
      return res.json({ status: 'created', id: newDoc.$id });
    }

  } catch (err) {
    error(err.message);
    return res.json({ error: err.message }, 500);
  }
};
