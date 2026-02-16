import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || "re_CeRTmETR_MHxYaF2sShjXcmSmZKE5qSzr";
const resend = new Resend(resendApiKey);

async function testResend() {
  console.log("=== Testing Resend API ===");
  console.log("API Key (first 15 chars):", resendApiKey.substring(0, 15) + "...");
  
  // 1. List domains to check if evgreen.lat is verified
  try {
    const domains = await resend.domains.list();
    console.log("\n--- Domains ---");
    console.log(JSON.stringify(domains, null, 2));
  } catch (e) {
    console.error("Error listing domains:", e.message);
  }

  // 2. List API keys
  try {
    const keys = await resend.apiKeys.list();
    console.log("\n--- API Keys ---");
    console.log(JSON.stringify(keys, null, 2));
  } catch (e) {
    console.error("Error listing API keys:", e.message);
  }

  // 3. Try sending a test email to see the exact error
  try {
    console.log("\n--- Sending test email ---");
    const result = await resend.emails.send({
      from: "EVGreen <invitaciones@evgreen.lat>",
      to: "test@example.com",
      subject: "Test email from EVGreen",
      html: "<p>This is a test email</p>",
      text: "This is a test email",
    });
    console.log("Send result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error sending test email:", e.message);
    console.error("Full error:", JSON.stringify(e, null, 2));
  }

  // 4. Check recent emails sent
  try {
    const emails = await resend.emails.list();
    console.log("\n--- Recent Emails ---");
    if (emails.data) {
      console.log(`Total emails found: ${emails.data.data?.length || 0}`);
      for (const email of (emails.data.data || []).slice(0, 5)) {
        console.log(`  - To: ${email.to}, Subject: ${email.subject}, Status: ${email.last_event}, Created: ${email.created_at}`);
      }
    } else {
      console.log("No email data:", JSON.stringify(emails, null, 2));
    }
  } catch (e) {
    console.error("Error listing emails:", e.message);
  }
}

testResend().catch(console.error);
