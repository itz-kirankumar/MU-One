const nodemailer = require('nodemailer');

const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    background-color: #F8F7F4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 40px 20px;
    color: #111;
  }
  .container {
    max-width: 560px;
    margin: 0 auto;
    background: #F8F7F4;
  }
  .header {
    display: flex;
    align-items: center;
    margin-bottom: 40px;
  }
  .logo {
    width: 24px;
    height: 24px;
    background: #f7d344;
    border-radius: 6px;
    display: inline-block;
    margin-right: 8px;
    vertical-align: middle;
  }
  .logo-text {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.5px;
    vertical-align: middle;
  }
  .pretitle {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 12px;
  }
  .title {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -1.5px;
    margin: 0 0 16px 0;
    line-height: 1.1;
  }
  .subtitle {
    font-size: 16px;
    color: #444;
    line-height: 1.5;
    margin-bottom: 40px;
  }
  .features {
    display: flex;
    gap: 16px;
    margin-bottom: 48px;
  }
  .feature-card {
    background: #fff;
    border: 1px solid #eaeaea;
    border-radius: 16px;
    padding: 20px;
    flex: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }
  .icon-box {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .f1 { background: #fee2e2; }
  .f2 { background: #dbeafe; }
  .f3 { background: #fef3c7; }
  .feature-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 4px 0;
  }
  .feature-desc {
    font-size: 12px;
    color: #666;
    margin: 0;
  }
  .section-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin: 0 0 16px 0;
  }
  .section-text {
    font-size: 15px;
    color: #555;
    line-height: 1.6;
    margin-bottom: 32px;
  }
  .divider {
    height: 1px;
    background: #eaeaea;
    margin: 40px 0;
  }
  .button {
    display: inline-block;
    background: #111;
    color: #fff;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 24px;
    margin-top: 16px;
  }
  .footer {
    font-size: 12px;
    color: #888;
    text-align: center;
    margin-top: 60px;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"></div>
      <span class="logo-text">MU One</span>
    </div>
    
    <div class="pretitle">Waitlist Confirmed</div>
    <h1 class="title">You're on the list.</h1>
    <p class="subtitle">Thanks for joining the MU One waitlist.<br>We're glad you're here.</p>

    <div class="features">
      <div class="feature-card">
        <div class="icon-box f1"></div>
        <h3 class="feature-title">Don't miss</h3>
        <p class="feature-desc">Track deadlines easily</p>
      </div>
      <div class="feature-card">
        <div class="icon-box f2"></div>
        <h3 class="feature-title">Stay synced</h3>
        <p class="feature-desc">Unified master calendar</p>
      </div>
      <div class="feature-card">
        <div class="icon-box f3"></div>
        <h3 class="feature-title">Find clarity</h3>
        <p class="feature-desc">Automated AI workflows</p>
      </div>
    </div>

    <h2 class="section-title">Master your student life.</h2>
    <p class="section-text">
      We're building MU One to help you navigate through your classes, assignments, and campus opportunities without the noise. Keeping everything you need on one unified dashboard, and keeping what you don't out of the way.
    </p>
    <p class="section-text" style="font-size: 13px; color: #777; margin-top: -16px;">
      <em>Please note: MU One is an unofficial student-built beta.</em>
    </p>

    <div class="divider"></div>

    <p class="section-text" style="margin-top: 24px;">
      We'll email you when your access opens.
      <br><br>
      See you soon,<br>
      <strong>The MU One team</strong>
    </p>

    <div class="footer">
      You received this email because you joined the MU One private beta waitlist.<br>
      Have a question or want to leave? Just reply to this email.<br><br>
      Privacy &middot; muone.live
    </div>
  </div>
</body>
</html>
`;

async function main() {
  let transporter = nodemailer.createTransport({
    host: 'aspmx.l.google.com',
    port: 25,
    secure: false,
    tls: { rejectUnauthorized: false }
  });
  let info = await transporter.sendMail({
    from: '"MU One" <hello@muone.live>',
    to: 'kiran.kumar2028@mastersunion.org',
    subject: "You're on the MU One waitlist",
    html: html,
  });
  console.log("Message sent: %s", info.messageId);
}
main();