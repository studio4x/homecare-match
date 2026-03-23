const fs = require('fs');
const path = './src/pages/dashboard/OverviewPage.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  '      <div className="space-y-6">\n        <div className="flex flex-col gap-1">',
  '      <div className="space-y-6">\n        <AdminMessageAlert />\n        <div className="flex flex-col gap-1">'
);
content = content.replace(
  '      <div className="space-y-6">\r\n        <div className="flex flex-col gap-1">',
  '      <div className="space-y-6">\r\n        <AdminMessageAlert />\r\n        <div className="flex flex-col gap-1">'
);
fs.writeFileSync(path, content, 'utf8');
console.log('Done');
