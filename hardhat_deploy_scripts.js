// ============================================================================
// CAI × ERC-8004 Framework - Hardhat Deployment Scripts
// ETH Shanghai 2025 Hackathon
// ============================================================================

// ============================================================================
// File: contracts/scripts/deploy-registry.js
// ============================================================================

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("📝 Deploying CAIRegistry...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Deploy CAIRegistry
  const CAIRegistry = await ethers.getContractFactory("CAIRegistry");
  const registry = await CAIRegistry.deploy();
  await registry.deployed();

  console.log("✅ CAIRegistry deployed to:", registry.address);
  console.log("   Transaction hash:", registry.deployTransaction.hash);
  console.log("   Gas used:", (await registry.deployTransaction.wait()).gasUsed.toString());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "CAIRegistry",
    address: registry.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: registry.deployTransaction.hash
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, `CAIRegistry_${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Wait for block confirmations (for verification)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting for 5 block confirmations...");
    await registry.deployTransaction.wait(5);
    console.log("✅ Confirmed!");
  }

  console.log("\n📋 To verify on Etherscan:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${registry.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ============================================================================
// File: contracts/scripts/deploy-anchor.js
// ============================================================================

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("⚓ Deploying AHINAnchor...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Deploy AHINAnchor
  const AHINAnchor = await ethers.getContractFactory("AHINAnchor");
  const anchor = await AHINAnchor.deploy();
  await anchor.deployed();

  console.log("✅ AHINAnchor deployed to:", anchor.address);
  console.log("   Transaction hash:", anchor.deployTransaction.hash);
  console.log("   Gas used:", (await anchor.deployTransaction.wait()).gasUsed.toString());

  // Initialize with deployer as authorized anchor
  console.log("\n🔧 Initializing anchor permissions...");
  const authTx = await anchor.addAuthorizedAnchor(deployer.address);
  await authTx.wait();
  console.log("✅ Authorized anchor:", deployer.address);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "AHINAnchor",
    address: anchor.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    txHash: anchor.deployTransaction.hash,
    authorizedAnchors: [deployer.address]
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, `AHINAnchor_${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Wait for block confirmations
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting for 5 block confirmations...");
    await anchor.deployTransaction.wait(5);
    console.log("✅ Confirmed!");
  }

  console.log("\n📋 To verify on Etherscan:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${anchor.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ============================================================================
// File: contracts/scripts/deploy-agent.js
// ============================================================================

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🤖 Deploying ERC8004Agent...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Load previously deployed contract addresses
  const registryAddress = process.env.REGISTRY_ADDRESS;
  const anchorAddress = process.env.ANCHOR_ADDRESS;

  if (!registryAddress || !anchorAddress) {
    console.error("❌ Error: REGISTRY_ADDRESS and ANCHOR_ADDRESS must be set");
    console.log("   Set them as environment variables or pass them to the script");
    process.exit(1);
  }

  console.log("📍 Using CAIRegistry at:", registryAddress);
  console.log("📍 Using AHINAnchor at:", anchorAddress, "\n");

  // Deploy ERC8004Agent
  const ERC8004Agent = await ethers.getContractFactory("ERC8004Agent");
  const agent = await ERC8004Agent.deploy(registryAddress, anchorAddress);
  await agent.deployed();

  console.log("✅ ERC8004Agent deployed to:", agent.address);
  console.log("   Transaction hash:", agent.deployTransaction.hash);
  console.log("   Gas used:", (await agent.deployTransaction.wait()).gasUsed.toString());

  // Verify configuration
  console.log("\n🔍 Verifying configuration...");
  const configuredRegistry = await agent.registry();
  const configuredAnchor = await agent.anchor();
  
  console.log("   Configured Registry:", configuredRegistry);
  console.log("   Configured Anchor:", configuredAnchor);
  
  if (configuredRegistry !== registryAddress || configuredAnchor !== anchorAddress) {
    console.error("❌ Configuration mismatch!");
    process.exit(1);
  }
  console.log("✅ Configuration verified!");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "ERC8004Agent",
    address: agent.address,
    deployer: deployer.address,
    dependencies: {
      registry: registryAddress,
      anchor: anchorAddress
    },
    timestamp: new Date().toISOString(),
    txHash: agent.deployTransaction.hash
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, `ERC8004Agent_${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Wait for block confirmations
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting for 5 block confirmations...");
    await agent.deployTransaction.wait(5);
    console.log("✅ Confirmed!");
  }

  console.log("\n📋 To verify on Etherscan:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${agent.address} ${registryAddress} ${anchorAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ============================================================================
// File: contracts/scripts/initialize.js
// ============================================================================

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("⚙️  Initializing CAI Framework Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Initializing with account:", deployer.address, "\n");

  // Load deployment addresses
  const deploymentsDir = path.join(__dirname, "../../deployments");
  const network = hre.network.name;

  const registryData = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, `CAIRegistry_${network}.json`))
  );
  const anchorData = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, `AHINAnchor_${network}.json`))
  );
  const agentData = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, `ERC8004Agent_${network}.json`))
  );

  // Attach to deployed contracts
  const registry = await ethers.getContractAt("CAIRegistry", registryData.address);
  const anchor = await ethers.getContractAt("AHINAnchor", anchorData.address);
  const agent = await ethers.getContractAt("ERC8004Agent", agentData.address);

  console.log("📍 Connected to:");
  console.log("   CAIRegistry:", registry.address);
  console.log("   AHINAnchor:", anchor.address);
  console.log("   ERC8004Agent:", agent.address, "\n");

  // 1. Add ERC8004Agent as authorized anchor
  console.log("1️⃣  Adding ERC8004Agent as authorized anchor...");
  const isAuthorized = await anchor.authorizedAnchors(agent.address);
  if (!isAuthorized) {
    const tx1 = await anchor.addAuthorizedAnchor(agent.address);
    await tx1.wait();
    console.log("   ✅ Transaction:", tx1.hash);
  } else {
    console.log("   ℹ️  Already authorized");
  }

  // 2. Add deployer as trusted issuer in registry (if not already)
  console.log("\n2️⃣  Verifying trusted issuer status...");
  const isTrusted = await registry.trustedIssuers(deployer.address);
  if (isTrusted) {
    console.log("   ✅ Deployer is already a trusted issuer");
  } else {
    const tx2 = await registry.addTrustedIssuer(deployer.address);
    await tx2.wait();
    console.log("   ✅ Added deployer as trusted issuer");
  }

  // 3. Register a test DID for deployer
  console.log("\n3️⃣  Registering test DID for deployer...");
  const didInfo = await registry.didRegistry(deployer.address);
  if (didInfo.createdAt.toNumber() === 0) {
    const testDIDDoc = "ipfs://QmTest123456789"; // Mock IPFS hash
    const tx3 = await registry.registerDID(testDIDDoc);
    await tx3.wait();
    console.log("   ✅ Test DID registered");
    console.log("   📄 DID Document:", testDIDDoc);
  } else {
    console.log("   ℹ️  DID already registered");
  }

  // 4. Issue a sample credential
  console.log("\n4️⃣  Issuing sample MandateVC...");
  const sampleCredentialHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("sample-mandate-vc-" + Date.now())
  );
  const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

  try {
    const tx4 = await registry.issueCredential(
      deployer.address,
      sampleCredentialHash,
      "MandateVC",
      expiresAt
    );
    await tx4.wait();
    console.log("   ✅ Sample credential issued");
    console.log("   🔑 Credential Hash:", sampleCredentialHash);
  } catch (error) {
    if (error.message.includes("credential already exists")) {
      console.log("   ℹ️  Sample credential already exists");
    } else {
      throw error;
    }
  }

  // 5. Test anchor a sample Merkle root
  console.log("\n5️⃣  Anchoring sample audit bundle...");
  const sampleMerkleRoot = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("sample-audit-bundle-" + Date.now())
  );
  const sampleMetadata = "ipfs://QmSampleAudit123";

  const tx5 = await anchor.anchorBlock(sampleMerkleRoot, 1, sampleMetadata);
  await tx5.wait();
  console.log("   ✅ Sample block anchored");
  console.log("   🔗 Merkle Root:", sampleMerkleRoot);
  console.log("   📦 Metadata URI:", sampleMetadata);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("✅ Initialization Complete!");
  console.log("=".repeat(70));
  console.log("\n📊 System Status:");
  console.log("   Total DIDs:", (await registry.totalDIDs()).toString());
  console.log("   Total Credentials:", (await registry.totalCredentials()).toString());
  console.log("   AHIN Blocks:", (await anchor.currentBlockNumber()).toString());
  console.log("   Total Transactions:", (await agent.totalTransactions()).toString());

  console.log("\n🎯 Next Steps:");
  console.log("   1. Start backend service: cd backend && npm run dev");
  console.log("   2. Start frontend app: cd frontend && npm run dev");
  console.log("   3. Run tests: npm test");

  console.log("\n💡 Test Credentials:");
  console.log("   DID:", deployer.address);
  console.log("   Credential Hash:", sampleCredentialHash);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ============================================================================
// File: contracts/hardhat.config.js
// ============================================================================

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    
    // Testnets
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: "auto",
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5,
    },
    
    // Mainnets (for reference)
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};

// ============================================================================
// File: contracts/.env.example
// ============================================================================

# Private key for deployment (DO NOT commit real keys!)
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000

# RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_INFURA_PROJECT_ID
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Gas reporting (optional)
REPORT_GAS=false
COINMARKETCAP_API_KEY=YOUR_CMC_API_KEY

# ============================================================================
# File: contracts/package.json
# ============================================================================

{
  "name": "cai-erc8004-contracts",
  "version": "1.0.0",
  "description": "CAI × ERC-8004 Security Framework Smart Contracts",
  "main": "index.js",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "test:coverage": "hardhat coverage",
    "deploy:local": "hardhat run scripts/deploy-registry.js --network localhost",
    "deploy:sepolia": "hardhat run scripts/deploy-registry.js --network sepolia",
    "node": "hardhat node",
    "clean": "hardhat clean"
  },
  "keywords": ["ethereum", "smart-contracts", "ai-agents", "erc8004"],
  "author": "CAI Framework Team",
  "license": "MIT",
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^3.0.0",
    "hardhat": "^2.17.0",
    "dotenv": "^16.3.1"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0"
  }
}