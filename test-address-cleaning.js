#!/usr/bin/env node

function cleanKoreanAddress(address) {
  if (!address) return address;
  
  let cleaned = address
    // Remove floor information (층, 지하, 지상, B1, 1F, etc.)
    .replace(/,?\s*\d+층[^,]*(?=,|$)/g, '')
    .replace(/,?\s*지하\d*층?[^,]*(?=,|$)/g, '')
    .replace(/,?\s*지상\d*층?[^,]*(?=,|$)/g, '')
    .replace(/,?\s*B\d+[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+F[^,]*(?=,|$)/g, '')
    
    // Remove room/unit numbers (호, 동)
    .replace(/,?\s*\d+호[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+동\s*\d+층[^,]*(?=,|$)/g, '')
    .replace(/,?\s*\d+동\s*\d+호[^,]*(?=,|$)/g, '')
    
    // Remove parenthetical details but keep main building names
    .replace(/,?\s*\([^)]*상가[^)]*\)/g, '') // Remove shopping complex details in parentheses
    .replace(/,?\s*\([^)]*동[^)]*\)/g, '') // Remove building section details
    
    // Remove specific patterns
    .replace(/,?\s*지하\s+\d+/g, '') // Remove "지하 58" type patterns
    .replace(/,?\s*[가-힣]*상가[^,]*(?=,|$)/g, '') // Remove shopping complex details
    
    // Clean up extra commas, spaces, and unmatched parentheses
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,|,\s*$/g, '')
    .replace(/\s*\)\s*$/g, '') // Remove trailing unmatched parentheses
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
    
  return cleaned;
}

// Test addresses from your CSV
const testAddresses = [
  "서울특별시 종로구 종로33길 12, 2층 2호 (효제동)",
  "서울특별시 종로구 종로 19, 지하1층 117-2호 (종로1가)",
  "서울특별시 중구 소공로 지하 58 (충무로1가, 회현지하상가 바열27호,사열1호)",
  "서울특별시 중구 퇴계로 447, 3층 325호 (황학동, 황학아크로타워)",
  "서울특별시 동대문구 장안벚꽃로 107, 1동 1층 143호 (장안동, 장안현대홈타운)"
];

console.log('🧹 Testing Address Cleaning:\n');

testAddresses.forEach((address, index) => {
  const cleaned = cleanKoreanAddress(address);
  console.log(`${index + 1}. Original: ${address}`);
  console.log(`   Cleaned:  ${cleaned}`);
  console.log(`   Changed:  ${address !== cleaned ? '✅ Yes' : '❌ No'}\n`);
});
