/**
 * HTML QA 匯入腳本
 * 從 Google Sheets 匯出的 HTML 檔案匯入知識庫
 *
 * 使用方式:
 * npx tsx scripts/import-html-qa.ts /path/to/工作表1.html
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

interface QARow {
  author: string;
  category: string;
  subCategory1: string;
  subCategory2: string;
  subCategory3: string;
  question: string;
  answer: string;
  linkText: string;
  linkUrl: string;
  date: string;
}

// 作者名稱對應 slug 的映射
const AUTHOR_SLUG_MAP: Record<string, string> = {
  '恩如': 'enru',
  // 可以在這裡添加更多作者映射
};

// 直接建立 Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractTextFromCell(cell: cheerio.Cheerio<cheerio.Element>): string {
  return cell.text().trim();
}

function extractLinkFromCell(cell: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): { text: string; url: string } | null {
  const anchor = cell.find('a');
  if (anchor.length > 0) {
    const url = anchor.attr('href') || '';
    const text = anchor.text().trim();
    if (url && text) {
      return { text, url };
    }
  }
  return null;
}

function parseHtmlTable(htmlContent: string): QARow[] {
  const $ = cheerio.load(htmlContent);
  const rows: QARow[] = [];

  // 找到表格的所有資料列（跳過第一列標題）
  $('table.waffle tbody tr').each((index, row) => {
    // 跳過標題列和 freezebar 列
    const rowId = $(row).find('th').attr('id');
    if (!rowId || rowId === '0R0') return;
    if ($(row).hasClass('freezebar-cell')) return;
    if ($(row).find('.freezebar-cell').length > 0 && $(row).find('td').length === 0) return;

    const cells = $(row).find('td');
    if (cells.length < 10) return;

    const question = extractTextFromCell($(cells[5]));
    const answer = extractTextFromCell($(cells[6]));

    // 跳過沒有問答的列
    if (!question || !answer) return;

    // 處理連結 - 先檢查 H 欄位（連結文字），再檢查 I 欄位（連結URL）
    let linkText = '';
    let linkUrl = '';

    // H 欄位可能有內嵌連結
    const hLink = extractLinkFromCell($(cells[7]), $);
    if (hLink) {
      linkText = hLink.text;
      linkUrl = hLink.url;
    } else {
      linkText = extractTextFromCell($(cells[7]));
    }

    // I 欄位可能有連結
    const iLink = extractLinkFromCell($(cells[8]), $);
    if (iLink && iLink.url) {
      linkUrl = iLink.url;
      if (!linkText) {
        linkText = iLink.text;
      }
    }

    const row_data: QARow = {
      author: extractTextFromCell($(cells[0])),
      category: extractTextFromCell($(cells[1])),
      subCategory1: extractTextFromCell($(cells[2])),
      subCategory2: extractTextFromCell($(cells[3])),
      subCategory3: extractTextFromCell($(cells[4])),
      question,
      answer,
      linkText,
      linkUrl,
      date: extractTextFromCell($(cells[9])),
    };

    rows.push(row_data);
  });

  return rows;
}

async function importToKnowledge(rows: QARow[]) {
  // 先取得所有作者的 ID 映射
  const authorIdMap: Record<string, string> = {};

  for (const authorName of Object.keys(AUTHOR_SLUG_MAP)) {
    const slug = AUTHOR_SLUG_MAP[authorName];
    const { data: author } = await supabase
      .from('authors')
      .select('id')
      .eq('slug', slug)
      .single();

    if (author) {
      authorIdMap[authorName] = author.id;
      console.log(`Author mapping: ${authorName} -> ${author.id}`);
    }
  }

  console.log(`\nImporting ${rows.length} QA items...`);
  console.log(`- Items with author will use specific author_id`);
  console.log(`- Items without author will be shared (author_id = null)\n`);

  let imported = 0;
  let skipped = 0;
  let sharedCount = 0;
  let authorSpecificCount = 0;

  for (const row of rows) {
    try {
      const now = new Date().toISOString();

      // 決定 author_id：有作者名稱就找對應的 ID，沒有就設為 null（共用）
      let authorId: string | null = null;
      if (row.author && row.author.trim()) {
        authorId = authorIdMap[row.author.trim()] || null;
        if (authorId) {
          authorSpecificCount++;
        } else {
          // 作者名稱有值但找不到對應的 ID，視為共用
          console.log(`  Warning: Unknown author "${row.author}", treating as shared`);
          sharedCount++;
        }
      } else {
        sharedCount++;
      }

      const { error } = await supabase
        .from('knowledge')
        .insert({
          author_id: authorId,
          title: row.question,
          content: row.answer,
          category: row.category || null,
          subcategory1: row.subCategory1 || null,
          subcategory2: row.subCategory2 || null,
          subcategory3: row.subCategory3 || null,
          link_text: row.linkText || null,
          link_url: row.linkUrl || null,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        throw error;
      }

      imported++;
      const authorLabel = authorId ? `[${row.author}]` : '[共用]';
      console.log(`✓ ${authorLabel} ${row.question.substring(0, 30)}...`);
    } catch (error: any) {
      console.error(`✗ Failed to import: ${row.question}`, error?.message || error);
      skipped++;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported}`);
  console.log(`  - Shared (null author_id): ${sharedCount}`);
  console.log(`  - Author-specific: ${authorSpecificCount}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${rows.length}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/import-html-qa.ts <html-file-path>');
    console.log('Example: npx tsx scripts/import-html-qa.ts ./工作表1.html');
    console.log('\nNote: author_id is determined by the "作者" column in HTML:');
    console.log('  - If author name matches known authors (e.g., "恩如"), uses that author_id');
    console.log('  - If empty or unknown, sets author_id to null (shared knowledge)');
    process.exit(1);
  }

  const htmlPath = args[0];

  if (!fs.existsSync(htmlPath)) {
    console.error(`File not found: ${htmlPath}`);
    process.exit(1);
  }

  console.log(`Reading HTML file: ${htmlPath}`);
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  console.log('Parsing HTML table...');
  const rows = parseHtmlTable(htmlContent);
  console.log(`Found ${rows.length} QA rows`);

  if (rows.length === 0) {
    console.log('No QA rows found. Please check the HTML file format.');
    process.exit(1);
  }

  // 統計作者分佈
  const authorCounts: Record<string, number> = {};
  for (const row of rows) {
    const author = row.author.trim() || '(空白 - 共用)';
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  }

  console.log('\n=== Author Distribution ===');
  for (const [author, count] of Object.entries(authorCounts)) {
    console.log(`  ${author}: ${count} items`);
  }

  // 顯示前 3 筆預覽
  console.log('\n=== Preview (first 3 rows) ===');
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(`  Author: ${row.author || '(共用)'}`);
    console.log(`  Category: ${row.category} / ${row.subCategory1} / ${row.subCategory2} / ${row.subCategory3}`);
    console.log(`  Q: ${row.question}`);
    console.log(`  A: ${row.answer.substring(0, 50)}...`);
    if (row.linkUrl) {
      console.log(`  Link: ${row.linkText} -> ${row.linkUrl}`);
    }
  });

  console.log('\n');

  // 自動執行匯入
  await importToKnowledge(rows);
}

main().catch(console.error);
