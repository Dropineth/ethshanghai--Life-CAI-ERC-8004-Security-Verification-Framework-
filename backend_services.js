// ============================================================================
// CAI × ERC-8004 Backend Services
// ETH Shanghai 2025 Hackathon
// ============================================================================

// ============================================================================
// File: backend/package.json
// ============================================================================

{
  "name": "cai-erc8004-backend",
  "version": "1.0.0",
  "description": "CAI Framework Backend Services - VC Issuer & AHIN Builder",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "build": "echo 'No build step required'"
  },
  "keywords": ["ai-agents", "verifiable-credentials", "ethereum", "erc8004"],
  "author": "CAI Framework Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "ethers": "^6.9.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "winston": "^3.11.0",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "tweetnacl": "^1.0.3",
    "tweetnacl-util": "^0.15.1",
    "uuid": "^9.0.1",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "eslint": "^8.56.0",
    "jest": "^29.7.0"
  }
}

// ============================================================================
// File: backend/.env.example
// ============================================================================

# Server Configuration
PORT=3001
NODE_ENV=development
API_SECRET=your-secret-key-change-in-production

# Ethereum Configuration
NETWORK=sepolia
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Contract Addresses (from deployment)
CAI_REGISTRY_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5
AHIN_ANCHOR_ADDRESS=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
ERC8004_AGENT_ADDRESS=0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE

# AHIN Configuration
AHIN_ANCHOR_INTERVAL=300000
AHIN_BATCH_SIZE=100

# Security
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

// ============================================================================
// File: backend/src/index.js
// ============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import vcRoutes from './routes/vc.routes.js';
import ahinRoutes from './routes/ahin.routes.js';
import auditRoutes from './routes/audit.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startAHINAnchorService } from './services/ahinAnchor.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// Middleware
// ============================================================================

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================================================
// Routes
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    name: 'CAI Framework Backend',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      vc: '/api/vc',
      ahin: '/api/ahin',
      audit: '/api/audit',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/vc', vcRoutes);
app.use('/api/ahin', ahinRoutes);
app.use('/api/audit', auditRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, async () => {
  logger.info(`🚀 CAI Backend running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🌐 Network: ${process.env.NETWORK}`);
  
  // Start background services
  try {
    await startAHINAnchorService();
    logger.info('⚓ AHIN Anchor service started');
  } catch (error) {
    logger.error('Failed to start AHIN service:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// ============================================================================
// File: backend/src/utils/logger.js
// ============================================================================

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// ============================================================================
// File: backend/src/utils/ethereum.js
// ============================================================================

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

export const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

export const getContract = (address, abi) => {
  return new ethers.Contract(address, abi, wallet);
};

export const isValidAddress = (address) => {
  return ethers.isAddress(address);
};

export const isValidHash = (hash) => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

// ============================================================================
// File: backend/src/services/vcIssuer.service.js
// ============================================================================

import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { wallet, getContract } from '../utils/ethereum.js';

const CAI_REGISTRY_ABI = [
  "function issueCredential(address subject, bytes32 credentialHash, string credentialType, uint256 expiresAt) external",
  "function verifyCredential(bytes32 credentialHash) view returns (bool)",
];

class VCIssuerService {
  constructor() {
    this.registry = getContract(
      process.env.CAI_REGISTRY_ADDRESS,
      CAI_REGISTRY_ABI
    );
  }

  /**
   * Create a Verifiable Credential
   */
  async createVC(data) {
    const {
      subject,
      credentialType = 'MandateVC',
      claims,
      expiresAt,
    } = data;

    // Generate VC
    const vc = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${uuidv4()}`,
      type: ['VerifiableCredential', credentialType],
      issuer: wallet.address,
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(expiresAt * 1000).toISOString(),
      credentialSubject: {
        id: subject,
        ...claims,
      },
    };

    // Sign VC
    const vcString = JSON.stringify(vc);
    const vcHash = ethers.keccak256(ethers.toUtf8Bytes(vcString));
    const signature = await wallet.signMessage(ethers.getBytes(vcHash));

    // Add proof
    vc.proof = {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      verificationMethod: wallet.address,
      proofPurpose: 'assertionMethod',
      signatureValue: signature,
    };

    logger.info('VC created', { vcId: vc.id, subject, credentialType });

    return {
      vc,
      vcHash,
      signature,
    };
  }

  /**
   * Issue VC on-chain
   */
  async issueVCOnChain(subject, vcHash, credentialType, expiresAt) {
    try {
      const tx = await this.registry.issueCredential(
        subject,
        vcHash,
        credentialType,
        expiresAt
      );

      logger.info('Issuing VC on-chain', { txHash: tx.hash });

      const receipt = await tx.wait();
      
      logger.info('VC issued successfully', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error('Failed to issue VC on-chain:', error);
      throw error;
    }
  }

  /**
   * Verify VC on-chain
   */
  async verifyVC(vcHash) {
    try {
      const isValid = await this.registry.verifyCredential(vcHash);
      logger.info('VC verification', { vcHash, isValid });
      return isValid;
    } catch (error) {
      logger.error('Failed to verify VC:', error);
      throw error;
    }
  }

  /**
   * Create Mandate VC
   */
  async createMandateVC(data) {
    const { subject, agent, budget, expiry, whitelist = [] } = data;

    const expiresAt = Math.floor(Date.now() / 1000) + expiry;

    return this.createVC({
      subject,
      credentialType: 'MandateVC',
      claims: {
        agent,
        budget,
        expiry,
        whitelist,
      },
      expiresAt,
    });
  }

  /**
   * Create Cart VC
   */
  async createCartVC(data) {
    const { subject, cartHash, items, totalAmount } = data;

    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    return this.createVC({
      subject,
      credentialType: 'CartVC',
      claims: {
        cartHash,
        items,
        totalAmount,
      },
      expiresAt,
    });
  }
}

export const vcIssuerService = new VCIssuerService();

// ============================================================================
// File: backend/src/services/ahinChain.service.js
// ============================================================================

import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';

class AHINChainService {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
  }

  /**
   * Add transaction to pending queue
   */
  addTransaction(txData) {
    const transaction = {
      id: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(txData))),
      data: txData,
      timestamp: Date.now(),
    };

    this.pendingTransactions.push(transaction);
    logger.info('Transaction added to AHIN queue', { txId: transaction.id });

    return transaction.id;
  }

  /**
   * Build AHIN block
   */
  buildBlock() {
    if (this.pendingTransactions.length === 0) {
      return null;
    }

    const transactions = this.pendingTransactions.splice(
      0,
      parseInt(process.env.AHIN_BATCH_SIZE) || 100
    );

    // Calculate Merkle root
    const leaves = transactions.map(tx => tx.id);
    const merkleRoot = this.calculateMerkleRoot(leaves);

    const prevHash = this.chain.length > 0
      ? this.chain[this.chain.length - 1].hash
      : ethers.ZeroHash;

    const block = {
      blockNumber: this.chain.length + 1,
      merkleRoot,
      prevHash,
      timestamp: Date.now(),
      transactions: transactions.map(tx => ({
        id: tx.id,
        data: tx.data,
      })),
      transactionCount: transactions.length,
    };

    // Calculate block hash
    block.hash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        merkleRoot: block.merkleRoot,
        prevHash: block.prevHash,
        timestamp: block.timestamp,
      }))
    );

    this.chain.push(block);

    logger.info('AHIN block built', {
      blockNumber: block.blockNumber,
      txCount: block.transactionCount,
      merkleRoot: block.merkleRoot,
    });

    return block;
  }

  /**
   * Calculate Merkle root
   */
  calculateMerkleRoot(leaves) {
    if (leaves.length === 0) return ethers.ZeroHash;
    if (leaves.length === 1) return leaves[0];

    const newLevel = [];

    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = i + 1 < leaves.length ? leaves[i + 1] : left;

      const combined = left < right
        ? ethers.concat([left, right])
        : ethers.concat([right, left]);

      newLevel.push(ethers.keccak256(combined));
    }

    return this.calculateMerkleRoot(newLevel);
  }

  /**
   * Generate Merkle proof
   */
  generateMerkleProof(txId) {
    const block = this.chain.find(b =>
      b.transactions.some(tx => tx.id === txId)
    );

    if (!block) return null;

    const leaves = block.transactions.map(tx => tx.id);
    const index = leaves.findIndex(id => id === txId);

    return this._generateProof(leaves, index);
  }

  _generateProof(leaves, index) {
    const proof = [];
    let currentLevel = leaves;
    let currentIndex = index;

    while (currentLevel.length > 1) {
      const newLevel = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        if (i === currentIndex || i + 1 === currentIndex) {
          const siblingIndex = i === currentIndex ? i + 1 : i;
          if (siblingIndex < currentLevel.length) {
            proof.push(currentLevel[siblingIndex]);
          }
        }

        const combined = left < right
          ? ethers.concat([left, right])
          : ethers.concat([right, left]);

        newLevel.push(ethers.keccak256(combined));
      }

      currentIndex = Math.floor(currentIndex / 2);
      currentLevel = newLevel;
    }

    return proof;
  }

  /**
   * Get chain statistics
   */
  getStats() {
    return {
      totalBlocks: this.chain.length,
      totalTransactions: this.chain.reduce((sum, b) => sum + b.transactionCount, 0),
      pendingTransactions: this.pendingTransactions.length,
      latestBlock: this.chain[this.chain.length - 1] || null,
    };
  }
}

export const ahinChainService = new AHINChainService();

// ============================================================================
// File: backend/src/services/ahinAnchor.service.js
// ============================================================================

import { logger } from '../utils/logger.js';
import { getContract } from '../utils/ethereum.js';
import { ahinChainService } from './ahinChain.service.js';

const AHIN_ANCHOR_ABI = [
  "function anchorBlock(bytes32 merkleRoot, uint256 transactionCount, string metadataURI) external",
  "function currentBlockNumber() view returns (uint256)",
];

class AHINAnchorService {
  constructor() {
    this.anchor = getContract(
      process.env.AHIN_ANCHOR_ADDRESS,
      AHIN_ANCHOR_ABI
    );
    this.intervalId = null;
  }

  /**
   * Start periodic anchoring
   */
  start() {
    const interval = parseInt(process.env.AHIN_ANCHOR_INTERVAL) || 300000; // 5 min

    this.intervalId = setInterval(async () => {
      await this.anchorPendingBlocks();
    }, interval);

    logger.info('AHIN Anchor service started', { interval });
  }

  /**
   * Stop anchoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('AHIN Anchor service stopped');
    }
  }

  /**
   * Anchor pending blocks to blockchain
   */
  async anchorPendingBlocks() {
    try {
      const block = ahinChainService.buildBlock();

      if (!block) {
        logger.debug('No pending transactions to anchor');
        return;
      }

      // Upload metadata to IPFS (simplified - using placeholder)
      const metadataURI = `ipfs://Qm${block.hash.slice(2, 48)}`;

      logger.info('Anchoring block to blockchain', {
        blockNumber: block.blockNumber,
        merkleRoot: block.merkleRoot,
        txCount: block.transactionCount,
      });

      const tx = await this.anchor.anchorBlock(
        block.merkleRoot,
        block.transactionCount,
        metadataURI
      );

      const receipt = await tx.wait();

      logger.info('Block anchored successfully', {
        blockNumber: block.blockNumber,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      });

      return {
        blockNumber: block.blockNumber,
        txHash: receipt.hash,
      };
    } catch (error) {
      logger.error('Failed to anchor block:', error);
    }
  }

  /**
   * Get anchor statistics
   */
  async getStats() {
    const currentBlock = await this.anchor.currentBlockNumber();
    const chainStats = ahinChainService.getStats();

    return {
      onChainBlocks: currentBlock.toString(),
      offChainBlocks: chainStats.totalBlocks,
      pendingTransactions: chainStats.pendingTransactions,
    };
  }
}

export const ahinAnchorService = new AHINAnchorService();

export const startAHINAnchorService = () => {
  ahinAnchorService.start();
};

// ============================================================================
// File: backend/src/routes/vc.routes.js
// ============================================================================

import express from 'express';
import Joi from 'joi';
import { vcIssuerService } from '../services/vcIssuer.service.js';
import { validateRequest } from '../middleware/validation.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const mandateVCSchema = Joi.object({
  subject: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  agent: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  budget: Joi.string().required(),
  expiry: Joi.number().positive().required(),
  whitelist: Joi.array().items(Joi.string()),
});

const cartVCSchema = Joi.object({
  subject: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  cartHash: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
  items: Joi.array().items(Joi.object()).required(),
  totalAmount: Joi.string().required(),
});

/**
 * POST /api/vc/mandate
 * Create Mandate VC
 */
router.post('/mandate', validateRequest(mandateVCSchema), async (req, res, next) => {
  try {
    const { vc, vcHash, signature } = await vcIssuerService.createMandateVC(req.body);

    // Optionally issue on-chain
    if (req.query.onchain === 'true') {
      const { txHash } = await vcIssuerService.issueVCOnChain(
        req.body.subject,
        vcHash,
        'MandateVC',
        Math.floor(Date.now() / 1000) + req.body.expiry
      );

      return res.json({
        vc,
        vcHash,
        signature,
        txHash,
      });
    }

    res.json({ vc, vcHash, signature });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/vc/cart
 * Create Cart VC
 */
router.post('/cart', validateRequest(cartVCSchema), async (req, res, next) => {
  try {
    const { vc, vcHash, signature } = await vcIssuerService.createCartVC(req.body);

    res.json({ vc, vcHash, signature });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vc/verify/:vcHash
 * Verify VC
 */
router.get('/verify/:vcHash', async (req, res, next) => {
  try {
    const { vcHash } = req.params;

    const isValid = await vcIssuerService.verifyVC(vcHash);

    res.json({ vcHash, isValid });
  } catch (error) {
    next(error);
  }
});

export default router;

// ============================================================================
// File: backend/src/routes/ahin.routes.js
// ============================================================================

import express from 'express';
import { ahinChainService } from '../services/ahinChain.service.js';
import { ahinAnchorService } from '../services/ahinAnchor.service.js';

const router = express.Router();

/**
 * POST /api/ahin/transaction
 * Add transaction to AHIN queue
 */
router.post('/transaction', async (req, res, next) => {
  try {
    const txId = ahinChainService.addTransaction(req.body);
    res.json({ txId, status: 'queued' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ahin/proof/:txId
 * Get Merkle proof for transaction
 */
router.get('/proof/:txId', async (req, res, next) => {
  try {
    const { txId } = req.params;
    const proof = ahinChainService.generateMerkleProof(txId);

    if (!proof) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ txId, proof });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ahin/stats
 * Get AHIN statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ahinAnchorService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ahin/anchor
 * Manually trigger anchoring
 */
router.post('/anchor', async (req, res, next) => {
  try {
    const result = await ahinAnchorService.anchorPendingBlocks();
    res.json(result || { message: 'No pending blocks' });
  } catch (error) {
    next(error);
  }
});

export default router;

// ============================================================================
// File: backend/src/routes/audit.routes.js
// ============================================================================

import express from 'express';
import { ahinChainService } from '../services/ahinChain.service.js';
import { wallet } from '../utils/ethereum.js';
import { ethers } from 'ethers';

const router = express.Router();

/**
 * POST /api/audit/bundle
 * Generate signed audit bundle
 */
router.post('/bundle', async (req, res, next) => {
  try {
    const { transactionId, mandateVC, cartHash, receiptHash } = req.body;

    const bundle = {
      bundle_id: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(req.body))),
      timestamp: Date.now(),
      transactionId,
      mandateVC,
      cartHash,
      receiptHash,
      agent: wallet.address,
    };

    // Sign bundle
    const bundleString = JSON.stringify(bundle);
    const signature = await wallet.signMessage(ethers.toUtf8Bytes(bundleString));

    res.json({
      ...bundle,
      signature,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// ============================================================================
// File: backend/src/middleware/validation.js
// ============================================================================

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message),
      });
    }

    next();
  };
};

// ============================================================================
// File: backend/src/middleware/errorHandler.js
// ============================================================================

import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// ============================================================================
// File: backend/README.md
// ============================================================================

# CAI Framework Backend

Node.js + Express backend services for VC issuance, AHIN chain building, and audit bundle generation.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev

# Run in production
npm start
```

## API Endpoints

### Verifiable Credentials

**POST /api/vc/mandate**
Create Mandate VC
```json
{
  "subject": "0x...",
  "agent": "0x...",
  "budget": "100000000000000000000",
  "expiry": 86400,
  "whitelist": ["merchant.eth"]
}
```

**POST /api/vc/cart**
Create Cart VC
```json
{
  "subject": "0x...",
  "cartHash": "0x...",
  "items": [...],
  "totalAmount": "95000000000000000000"
}
```

**GET /api/vc/verify/:vcHash**
Verify VC on-chain

### AHIN Services

**POST /api/ahin/transaction**
Add transaction to queue

**GET /api/ahin/proof/:txId**
Get Merkle proof

**GET /api/ahin/stats**
Get AHIN statistics

**POST /api/ahin/anchor**
Manually trigger anchoring

### Audit Services

**POST /api/audit/bundle**
Generate signed audit bundle

## Architecture

```
backend/
├── src/
│   ├── services/         # Business logic
│   │   ├── vcIssuer.service.js
│   │   ├── ahinChain.service.js
│   │   └── ahinAnchor.service.js
│   ├── routes/           # API routes
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utilities
│   └── index.js          # Entry point
├── logs/                 # Log files
└── package.json
```

## License

MIT