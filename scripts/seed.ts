import { DEMO_EMAIL, demoPassword, ensureDemoAccount } from "@/server/demo";

ensureDemoAccount()
  .then(() => {
    console.log(`Demo account ready: ${DEMO_EMAIL} / ${demoPassword()}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
