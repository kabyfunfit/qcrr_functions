import { Client, Databases, Query, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  // Parse Payload
  let payload;
  try {
    payload = JSON.parse(req.body);
  } catch (err) {
    return res.json({ success: false, error: "Invalid JSON" });
  }

  const { email, name } = payload;
  // Keep the timezone fix so dates are correct in AZ
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' });
  
  const DB_ID = '697e7098000a1a51bb73';
  const RSVP_COLLECTION = 'rsvp';

  try {
    // 1. Check if they exist
    const result = await databases.listDocuments(DB_ID, RSVP_COLLECTION, [
      Query.equal('email', email)
    ]);

    let userName = name; 
    let finalStatus = 'checkin_existing';

    if (result.total > 0) {
      // === RETURNING PLAYER ===
      const doc = result.documents[0];
      userName = doc.name;
      
      // If already checked in today, just stop
      if (doc.attendance_log && doc.attendance_log.includes(today)) {
        return res.json({ success: true, status: 'already_checked_in', name: userName });
      }
      
      // Add today to log
      const newLog = doc.attendance_log ? [...doc.attendance_log, today] : [today];
      await databases.updateDocument(DB_ID, RSVP_COLLECTION, doc.$id, { attendance_log: newLog });
      
    } else {
      // === NEW PLAYER ===
      if (!name) return res.json({ success: false, status: 'needs_name' });
      
      // Just save them to the DB. DO NOT create a login account (too slow).
      await databases.createDocument(DB_ID, RSVP_COLLECTION, ID.unique(), {
          email, name, attendance_log: [today], can_reserve: false, is_member: false
      });
      finalStatus = 'checkin_new';
    }

    return res.json({ success: true, status: finalStatus, name: userName });

  } catch (err) {
    error(err.message); // Log the error to Appwrite console
    return res.json({ success: false, error: err.message });
  }
};
