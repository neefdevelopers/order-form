const assert = require('assert');
const ExcelJS = require('exceljs');

const BASE_URL = 'http://localhost:5000';

async function runFilterExportTests() {
  console.log('====================================================');
  console.log('   ID FILTRATION & FILTERED EXCEL EXPORT TESTS      ');
  console.log('====================================================\n');

  // 1. Admin Login
  console.log('1. Authenticating Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200);
  const { token: adminToken } = await loginRes.json();
  console.log('   ✓ Admin authenticated.');

  // 2. Fetch all orders
  const ordersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(ordersRes.status, 200);
  const allOrders = await ordersRes.json();
  assert(allOrders.length >= 2, 'Need at least 2 orders to test filtration');
  console.log(`   ✓ Found ${allOrders.length} total orders in database.`);

  const targetOrder = allOrders[0];
  const targetOrderId = targetOrder.id;
  const targetPromoterId = targetOrder.promoter_id;
  console.log(`   ✓ Target Order for filtration: ID=${targetOrderId}, Promoter=${targetPromoterId}`);

  // 3. Test Full Export (all orders)
  console.log('\n2. Testing Full (Unfiltered) Export...');
  const fullExportRes = await fetch(`${BASE_URL}/api/admin/orders/export`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(fullExportRes.status, 200);
  const fullWorkbook = new ExcelJS.Workbook();
  await fullWorkbook.xlsx.load(Buffer.from(await fullExportRes.arrayBuffer()));
  const fullSheet = fullWorkbook.getWorksheet('Orders');
  const fullRowCount = fullSheet.rowCount - 1; // subtract header
  assert.strictEqual(fullRowCount, allOrders.length, 'Full export row count must equal all orders count');
  console.log(`   ✓ Unfiltered Excel export contains all ${fullRowCount} orders.`);

  // 4. Test Filtered Export via POST { ids: [targetOrderId] }
  console.log('\n3. Testing Filtered Export (Single Order ID)...');
  const filteredExportRes = await fetch(`${BASE_URL}/api/admin/orders/export`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}` 
    },
    body: JSON.stringify({ ids: [targetOrderId] })
  });
  assert.strictEqual(filteredExportRes.status, 200);
  const filteredDisposition = filteredExportRes.headers.get('content-disposition');
  assert(filteredDisposition.includes('Orders_Filtered_'), 'Filename must indicate filtered export');

  const filteredWorkbook = new ExcelJS.Workbook();
  await filteredWorkbook.xlsx.load(Buffer.from(await filteredExportRes.arrayBuffer()));
  const filteredSheet = filteredWorkbook.getWorksheet('Orders');
  const filteredRowCount = filteredSheet.rowCount - 1; // subtract header
  assert.strictEqual(filteredRowCount, 1, 'Filtered export must contain exactly 1 order row');
  
  const exportedRowId = filteredSheet.getRow(2).getCell(1).value;
  assert.strictEqual(exportedRowId, targetOrderId, 'Exported row ID must match target order ID');
  console.log(`   ✓ Filtered Excel export contains ONLY 1 row for Order ID: ${exportedRowId}`);
  console.log(`   ✓ Filename correctly indicates: "${filteredDisposition}"`);

  // 5. Test Filtered Export via Query Params (promoter_id filter)
  console.log('\n4. Testing Filtered Export via Promoter ID query param...');
  const promoterOrders = allOrders.filter(o => o.promoter_id.toLowerCase() === targetPromoterId.toLowerCase());
  const promoterExportRes = await fetch(`${BASE_URL}/api/admin/orders/export?promoter_id=${encodeURIComponent(targetPromoterId)}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(promoterExportRes.status, 200);
  const promoterWorkbook = new ExcelJS.Workbook();
  await promoterWorkbook.xlsx.load(Buffer.from(await promoterExportRes.arrayBuffer()));
  const promoterSheet = promoterWorkbook.getWorksheet('Orders');
  const promoterRowCount = promoterSheet.rowCount - 1;
  assert.strictEqual(promoterRowCount, promoterOrders.length, 'Row count must match promoter orders count');
  console.log(`   ✓ Promoter ID filtered export contains exactly ${promoterRowCount} orders for Promoter: ${targetPromoterId}`);

  console.log('\n====================================================');
  console.log('   ALL FILTRATION & FILTERED EXPORT TESTS PASSED!   ');
  console.log('====================================================\n');
}

runFilterExportTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
