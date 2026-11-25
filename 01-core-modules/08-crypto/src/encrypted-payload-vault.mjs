import crypto from 'node:crypto';

// Kasus di Aplikasi: Brankas Token OAuth Terenkripsi dengan Proteksi Multi-Tenant
class SecretVault {
  #derivedKey;

  constructor(masterPassphrase, masterSalt) {
    // Normal: derivasi kunci 256-bit (32 byte) dari passphrase dan salt menggunakan scrypt
    this.#derivedKey = crypto.scryptSync(masterPassphrase, masterSalt, 32, {
      N: 16384,
      r: 8,
      p: 1,
    });
  }

  // Normal: mengamankan plaintext dengan enkripsi AES-256-GCM dan mengikat tenantId sebagai AAD
  seal(plaintext, tenantId) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.#derivedKey, iv);

    // Sematkan tenantId sebagai data otentikasi tambahan (AAD)
    cipher.setAAD(Buffer.from(tenantId, 'utf8'));

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
      tenantId,
    };
  }

  // Normal: membuka data terenkripsi dan memvalidasi keaslian auth tag serta kecocokan tenant
  unseal(envelope, requestedTenantId) {
    if (envelope.tenantId !== requestedTenantId) {
      throw new Error(
        'Tenant mismatch: token cannot be unsealed for this tenant',
      );
    }

    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.#derivedKey,
      iv,
      {
        authTagLength: 16,
      },
    );

    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(requestedTenantId, 'utf8'));

    let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

const masterPass = 'Env-Master-Key-Secret-2026';
const masterSalt = 'tenant-vault-salt-987';
const vault = new SecretVault(masterPass, masterSalt);

const oauthToken = 'gho_9812471894y12784y12894719284';
const tenantId = 'org-acme-corp';

// Normal: enkripsi dan dekripsi token yang valid
const sealed = vault.seal(oauthToken, tenantId);
console.log('Sealed ciphertext length:', sealed.ciphertext.length);
console.log('IV length (hex):', sealed.iv.length);
console.log('Auth tag length (hex):', sealed.authTag.length);

const unsealed = vault.unseal(sealed, tenantId);
console.log('Unsealed token matches:', unsealed === oauthToken);

// Edge-case: penolakan akses lintas tenant (cross-tenant data leakage prevention)
try {
  vault.unseal(sealed, 'org-hacker-tenant');
} catch (err) {
  console.log('Cross-tenant block:', err.message);
}

// Edge-case: deteksi manipulasi ciphertext (tamper detection)
try {
  const tampered = {
    ...sealed,
    ciphertext: sealed.ciphertext.slice(0, -2) + '00',
  };
  vault.unseal(tampered, tenantId);
} catch (err) {
  console.log('Tamper detection:', err.message);
}
