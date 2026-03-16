// ══════════════════════════════════════════════════════
//  ADMIN THE MT → Google Sheet Backup (ProShip Flash)
//  รองรับ: sync ออเดอร์ + ลบออเดอร์ (realtime)
// ══════════════════════════════════════════════════════

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action || 'sync';

  // ═══ ลบออเดอร์ ═══
  if (action === 'delete') {
    var orderNumber = data.order_number;
    if (!orderNumber) return ContentService.createTextOutput(JSON.stringify({ok:false, msg:'no order_number'}));
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return ContentService.createTextOutput(JSON.stringify({ok:true, deleted:0}));
    
    // หา order_number ใน column 15
    var col = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
    var deleted = 0;
    for (var i = col.length - 1; i >= 0; i--) {
      if (col[i][0] === orderNumber) {
        sheet.deleteRow(i + 2);
        deleted++;
      }
    }
    return ContentService.createTextOutput(
      JSON.stringify({ok:true, deleted:deleted})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // ═══ Sync ออเดอร์ ═══
  var orders = data.orders || [];

  // สร้างหัวตาราง (ถ้า Sheet ว่าง)
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
      'Remark\nหมายเหตุ',
      'Province\nจังหวัด',
      'Slip\nสลิปโอนเงิน',
      'OrderID'
    ]);
    var header = sheet.getRange(1, 1, 1, 15);
    header.setFontWeight('bold');
    header.setBackground('#B8860B');
    header.setFontColor('#FFFFFF');
    header.setWrap(true);
    header.setVerticalAlignment('middle');
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 120);
    sheet.setColumnWidth(5, 150);
    sheet.setColumnWidth(6, 80);
    sheet.setColumnWidth(7, 180);
    sheet.setColumnWidth(8, 200);
    sheet.setColumnWidth(9, 120);
    sheet.setColumnWidth(10, 100);
    sheet.setColumnWidth(11, 100);
    sheet.setColumnWidth(12, 200);
    sheet.setColumnWidth(13, 120);
    sheet.setColumnWidth(14, 300);
    sheet.setColumnWidth(15, 1);
    sheet.setRowHeight(1, 50);
  }

  // ป้องกันซ้ำ
  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    try {
      var col = sheet.getRange(2, 15, lastRow - 1, 1).getValues();
      col.forEach(function(r) { if (r[0]) existing[r[0]] = true; });
    } catch(e) {}
  }

  var added = 0;
  orders.forEach(function(o) {
    if (!existing[o.order_number]) {
      sheet.appendRow([
        o.phone, o.name, o.address, o.sub_district, o.district, o.zip,
        o.fb, o.channel, o.admin, o.price, o.cod, o.remark,
        o.province, '', o.order_number
      ]);
      // ใส่ IMAGE formula สำหรับสลิป
      if (o.slip && o.slip.length > 5) {
        var row = sheet.getLastRow();
        sheet.getRange(row, 14).setFormula('=IMAGE("' + o.slip + '", 1)');
        sheet.setRowHeight(row, 200);
      }
      added++;
      existing[o.order_number] = true;
    }
  });

  return ContentService.createTextOutput(
    JSON.stringify({ok:true, added:added, total:orders.length})
  ).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('ADMIN THE MT Backup is ready!');
}
