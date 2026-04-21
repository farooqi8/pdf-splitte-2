process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'Node',
})
require('ts-node/register')

const test = require('node:test')
const assert = require('node:assert/strict')
const xlsx = require('xlsx')
const { readExcel } = require('../lib/excel/reader')

function makeWorkbookBuffer(rows) {
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.json_to_sheet(rows)
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(out)
}

test('readExcel builds PermitMap with normalised permit numbers', () => {
  const buffer = makeWorkbookBuffer([
    {
      'permit number': ' ab-12.3 ',
      'owner name': 'Owner A',
      'plate number': 'ABC 123',
      tonnage: '10',
      classification: 'X',
    },
    {
      'permit number': 'ZZ 9-9',
      'owner name': 'Owner B',
      'plate number': 'XYZ 999',
      tonnage: '20',
      classification: 'Y',
    },
  ])

  const map = readExcel(buffer, 'saad')
  assert.equal(map.size, 2)

  const row1 = map.get('AB123')
  assert.ok(row1)
  assert.equal(row1.owner, 'saad')
  assert.equal(row1.raw_permit, 'ab-12.3')
  assert.equal(row1.owner_name, 'Owner A')
  assert.equal(row1.plate_number, 'ABC 123')
})

