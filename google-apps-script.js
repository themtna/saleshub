// ══════════════════════════════════════════════════════
//  SalesHub → Google Sheet Backup (รูปแบบ ProShip Flash)
//  วิธีใช้:
//  1. เปิด Google Sheet ใหม่
//  2. กด ส่วนขยาย → Apps Script
//  3. ลบโค้ดเดิม วางโค้ดนี้ทั้งหมด
//  4. กด "ทำให้ใช้งานได้" → การทำให้ใช้งานได้แบบใหม่
//     - ประเภท: เว็บแอป
//     - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
//  5. กด ทำให้ใช้งานได้ → อนุญาตสิทธิ์
//  6. คัดลอก URL ไปวางใน SalesHub แท็บ Backup
// ══════════════════════════════════════════════════════

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var orders = data.orders;

  // สร้างหัวตาราง ProShip (ถ้า Sheet ว่าง)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'MobileNo*\nเบอร์มือถือ',
      'Name\nชื่อ',
      'Address\nที่อยู่',
      'SubDistrict\nตำบล',
      'District\nอำเภอ',
      'ZIP\nรหัส ปณ.',
      'Customer FB/Line\nเฟส/ไลน์ลูกค้า',
      'SalesChannel\nช่องทางจำหน่าย',
      'SalesPerson\nชื่อแอดมิน',
      'SalePrice\nราคาขาย',
      'COD*\nยอดเก็บเงินปลายทาง',
      'Remark\nหมายเหตุ'
    ]);
    // จัดรูปแบบหัว
    var header = sheet.getRange(1, 1, 1, 12);
    header.setFontWeight('bold');
    header.setBackground('#B8860B');
    header.setFontColor('#FFFFFF');
    header.setWrap(true);

    // ตั้งความกว้างคอลัมน์
    sheet.setColumnWidth(1, 120);  // เบอร์
    sheet.setColumnWidth(2, 150);  // ชื่อ
    sheet.setColumnWidth(3, 250);  // ที่อยู่
    sheet.setColumnWidth(4, 120);  // ตำบล
    sheet.setColumnWidth(5, 150);  // อำเภอ
    sheet.setColumnWidth(6, 80);   // ZIP
    sheet.setColumnWidth(7, 180);  // FB/Line
    sheet.setColumnWidth(8, 200);  // ช่องทาง
    sheet.setColumnWidth(9, 120);  // แอดมิน
    sheet.setColumnWidth(10, 100); // ราคาขาย
    sheet.setColumnWidth(11, 100); // COD
    sheet.setColumnWidth(12, 200); // หมายเหตุ
  }

  // หาเบอร์+ชื่อที่มีอยู่แล้ว (ป้องกันซ้ำ โดยเช็คจาก order_number ที่ซ่อนใน column 13)
  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    try {
      var col = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
      col.forEach(function(r) { if (r[0]) existing[r[0]] = true; });
    } catch(e) {}
    // fallback: เช็คจาก เบอร์+ชื่อ
    if (Object.keys(existing).length === 0) {
      var phones = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      phones.forEach(function(r) { existing[r[0] + '|' + r[1]] = true; });
    }
  }

  // เพิ่มเฉพาะออเดอร์ใหม่
  var added = 0;
  orders.forEach(function(o) {
    var key = o.order_number || (o.phone + '|' + o.name);
    if (!existing[key]) {
      sheet.appendRow([
        o.phone, o.name, o.address, o.sub_district, o.district, o.zip,
        o.fb, o.channel, o.admin, o.price, o.cod, o.remark,
        o.order_number  // column 13 (ซ่อนไว้ สำหรับเช็คซ้ำ)
      ]);
      added++;
      existing[key] = true;
    }
  });

  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, added: added, total: orders.length })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('SalesHub ProShip Backup is ready!');
}
