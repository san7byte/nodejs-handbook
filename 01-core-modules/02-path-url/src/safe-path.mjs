import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');

export function getSafePath(baseDir, userInput) {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, userInput);

  // OWASP Defense: Enforce boundary check with path.sep
  if (!target.startsWith(resolvedBase + path.sep)) {
    throw new Error('Access denied: Path traversal detected');
  }

  return target;
}

try {
  const safeFile = getSafePath(PUBLIC_DIR, 'images/avatar.png');
  console.log('Valid path allowed:', safeFile.endsWith('public/images/avatar.png'));

  // Attempt 1: Classic directory traversal
  getSafePath(PUBLIC_DIR, '../../etc/passwd');
} catch (err) {
  console.log('Blocked traversal attack:', err.message);
}

try {
  // Attempt 2: Sibling directory prefix collision attack
  getSafePath(PUBLIC_DIR, '../public-secret/credentials.env');
} catch (err) {
  console.log('Blocked sibling escape attack:', err.message);
}

