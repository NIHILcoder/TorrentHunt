const fs = require('fs');
const path = require('path');

function replaceStrings(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Inject useTranslation if not present
  if (!content.includes('useTranslation')) {
    content = content.replace("import {", "import { useTranslation } from '../utils/i18nContext';\nimport {");
  }

  // Inject const { t } = useTranslation(); into components
  // Naive injection for the main component of the file
  const componentNameMatch = content.match(/const ([A-Za-z0-9]+): React\.FC.*?=.*?{/);
  if (componentNameMatch && !content.includes('const { t } = useTranslation();')) {
    const startIdx = content.indexOf(componentNameMatch[0]) + componentNameMatch[0].length;
    content = content.slice(0, startIdx) + '\n  const { t } = useTranslation();' + content.slice(startIdx);
  }

  // Replace all texts
  for (const [original, replacement] of Object.entries(replacements)) {
    // Replace exact text nodes
    const textRegex = new RegExp(`>\\s*${original}\\s*<`, 'g');
    content = content.replace(textRegex, `>{t('${replacement}')}<`);

    // Replace string attributes (like placeholder="", title="")
    const attrRegex = new RegExp(`(placeholder|title)="${original}"`, 'g');
    content = content.replace(attrRegex, `$1={t('${replacement}')}`);
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${path.basename(filePath)}`);
}

const downloadsPagePath = path.join(__dirname, 'renderer', 'pages', 'DownloadsPage.tsx');
const createTorrentPagePath = path.join(__dirname, 'renderer', 'pages', 'CreateTorrentPage.tsx');
const catalogPagePath = path.join(__dirname, 'renderer', 'pages', 'CatalogPage.tsx');

// Add translation mapping
replaceStrings(downloadsPagePath, {
  'Downloads': 'nav.downloads',
  'Add Torrent': 'btn.addTorrent',
  'Add URL/Magnet': 'btn.addUrl',
  'Search downloads...': 'search.placeholder',
  'Name': 'table.name',
  'Size': 'table.size',
  'Progress': 'table.progress',
  'Status': 'table.status',
  'Speed': 'table.speed',
  'ETA': 'table.eta',
  'Peers': 'table.peers',
});

replaceStrings(createTorrentPagePath, {
  'Create New Torrent': 'create.title',
  'Share your files with the world': 'create.subtitle',
  'Select Files or Folders': 'create.selectFiles',
  'Drag & Drop files here': 'create.drop',
  'or click to browse': 'create.browse',
  'Torrent Name': 'create.name',
  'Enter a descriptive name': 'create.name.placeholder',
  'Trackers': 'create.trackers',
  'One tracker URL per line': 'create.trackers.placeholder',
  'Comment': 'create.comment',
  'Optional description': 'create.comment.placeholder',
  'Private Torrent': 'create.private',
  'Start seeding immediately': 'create.startSeeding',
  'Create & Save Torrent': 'create.submit'
});

replaceStrings(catalogPagePath, {
  'Community Catalog': 'catalog.title',
  'Discover public domain and open source content': 'catalog.subtitle',
  'Search catalog...': 'catalog.search',
  'Refresh': 'catalog.refresh',
  'Add to Downloads': 'catalog.add',
  'All Categories': 'catalog.category.all'
});
