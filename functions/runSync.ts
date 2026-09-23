import * as admin from "firebase-admin";
import { syncUserCalendar } from "./src/sync/syncUserCalendar";
import { getDb } from "./src/utils/getDb";




// Make sure to load credentials if needed. Local emulator requires FIRESTORE_EMULATOR_HOST
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    // try to default it if it's local
    
}

const app = admin.initializeApp({
  projectId: "mu-one-508502"
});

async function run() {
  const db = getDb();
  
  const emails = [
    "gnana.yadeswar2027@mastersunion.org",
    "purnisha.tomar2027@mastersunion.org",
    "natasha.badani2027@mastersunion.org",
    "aryan.subramanya2027@mastersunion.org",
    "aishwarya.swadhini2027@mastersunion.org",
    "venkatesh.prasadh2027@mastersunion.org",
    "esheta.rathi2027@mastersunion.org",
    "bhagyam.maheshwary2028@mastersunion.org",
    "shaik.hassaan2028@mastersunion.org",
    "ylc27paavan.agrawal@mastersunion.org",
    "kohinoor.mukherjee2027@mastersunion.org",
    "vansh.arora2027@mastersunion.org",
    "mokssh.jaiin2028@mastersunion.org",
    "ylc27aryan.sharma@mastersunion.org",
    "vasudha.jajodia2027@mastersunion.org",
    "amitesh.kumar2027@mastersunion.org",
    "muchalapuri.teja2027@mastersunion.org",
    "nemil.doshi2027@mastersunion.org",
    "vaishnavi.kandala2027@mastersunion.org",
    "anushree.mukherjee2027@mastersunion.org",
    "twinkle.monga2027@mastersunion.org",
    "digvijay.jain2027@mastersunion.org",
    "harsha.sadhu2027@mastersunion.org",
    "kavita.kulkarni2027@mastersunion.org",
    "bhavika.agarwal2028@mastersunion.org",
    "saksheth.rao2027@mastersunion.org",
    "param.parekh2027@mastersunion.org",
    "muskaan.khandpur2027@mastersunion.org",
    "shresht.setty2027@mastersunion.org",
    "aditya.jain2027@mastersunion.org",
    "shivanand.shukla2027@mastersunion.org",
    "aaryan.bansal2027@mastersunion.org",
    "hridyansh.sandilya2028@mastersunion.org",
    "stuti.chaudhary2028@mastersunion.org",
    "rahul.kotkar2027@mastersunion.org",
    "naga.supriya2027@mastersunion.org",
    "prateek.gupta2027@mastersunion.org",
    "aradhya.bapna2027@mastersunion.org",
    "prakhar.murary2027@mastersunion.org",
    "akash.v2028@mastersunion.org",
    "aryan.salooja2028@mastersunion.org",
    "mrigendra.chauhan2028@mastersunion.org",
    "jay.chowdhary2027@mastersunion.org",
    "harith.bairagoni2027@mastersunion.org",
    "om.umrania2028@mastersunion.org",
    "arshia.gupta2027@mastersunion.org",
    "ravi.sheshank_cmt3@mastersunion.org"
  ];
  
  const usersSnap = await db.collection("users").where("email", "in", emails.slice(0, 30)).get();
  const usersSnap2 = await db.collection("users").where("email", "in", emails.slice(30)).get();
  
  const uids = [...usersSnap.docs, ...usersSnap2.docs].map(d => d.id);
  
  console.log(`Found ${uids.length} users out of ${emails.length}`);
  
  for (const uid of uids) {
    console.log(`Syncing calendar for ${uid}...`);
    try {
      const result = await syncUserCalendar(uid, 30);
      console.log(`Synced ${uid}: ${result.eventsNormalized} events, ${result.calendarsRead} calendars`);
    } catch (e) {
      console.error(`Error syncing ${uid}: ${e}`);
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
