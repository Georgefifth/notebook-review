import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/qa', timeout: 60000, workers: 1, retries: 0,
  reporter: [['list'], ['json', {outputFile:'evidence/qa-firefox/results.json'}]],
  use: { browserName:'firefox', headless:true, viewport:{width:1440,height:1000}, screenshot:'only-on-failure', trace:'off' },
  projects: [
    {name:'deployed-firefox',use:{baseURL:'https://georgefifth.github.io/notebook-review/'}},
    {name:'local-firefox',use:{baseURL:'http://127.0.0.1:4187/'}},
  ],
  webServer:{command:'npm start',url:'http://127.0.0.1:4187',reuseExistingServer:false,env:{PORT:'4187'}},
});
