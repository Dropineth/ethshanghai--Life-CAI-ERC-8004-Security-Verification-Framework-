// ============================================================================
// CAI × ERC-8004 Framework - Complete Test Suite
// ETH Shanghai 2025 Hackathon
// ============================================================================

// ============================================================================
// File: contracts/test/CAIRegistry.test.js
// ============================================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CAIRegistry", function () {
  let registry;
  let owner, user1, user2, issuer;

  beforeEach(async function () {
    [owner, user1, user2, issuer] = await ethers.getSigners();
    
    const CAIRegistry = await ethers.getContractFactory("CAIRegistry");
    registry = await CAIRegistry.deploy();
    await registry.deployed();
  });

  describe("DID Registration", function () {
    it("Should register a new DID", async function () {
      const didDoc = "ipfs://QmTest123";
      
      await expect(registry.connect(user1).registerDID(didDoc))
        .to.emit(registry, "DIDRegistered")
        .withArgs(user1.address, didDoc, await getBlockTimestamp());
      
      const did = await registry.getDID(user1.address);
      expect(did.owner).to.equal(user1.address);
      expect(did.didDocument).to.equal(didDoc);
      expect(did.status).to.equal(1); // Active
    });

    it("Should fail to register duplicate DID", async function () {
      await registry.connect(user1).registerDID("ipfs://QmTest1");
      
      await expect(
        registry.connect(user1).registerDID("ipfs://QmTest2")
      ).to.be.revertedWith("CAIRegistry: DID already registered");
    });

    it("Should update DID document", async function () {
      await registry.connect(user1).registerDID("ipfs://QmTest1");
      const newDoc = "ipfs://QmTest2";
      
      await expect(registry.connect(user1).updateDID(newDoc))
        .to.emit(registry, "DIDUpdated")
        .withArgs(user1.address, newDoc, await getBlockTimestamp());
      
      const did = await registry.getDID(user1.address);
      expect(did.didDocument).to.equal(newDoc);
    });

    it("Should revoke DID", async function () {
      await registry.connect(user1).registerDID("ipfs://QmTest1");
      
      await expect(registry.connect(user1).revokeDID(user1.address))
        .to.emit(registry, "DIDRevoked")
        .withArgs(user1.address, await getBlockTimestamp());
      
      const did = await registry.getDID(user1.address);
      expect(did.status).to.equal(2); // Revoked
    });
  });

  describe("Credential Management", function () {
    beforeEach(async function () {
      await registry.connect(user1).registerDID("ipfs://QmUser1");
      await registry.addTrustedIssuer(issuer.address);
    });

    it("Should issue credential", async function () {
      const credHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-cred"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(
        registry.connect(issuer).issueCredential(
          user1.address,
          credHash,
          "MandateVC",
          expiresAt
        )
      ).to.emit(registry, "CredentialIssued")
        .withArgs(credHash, user1.address, await getBlockTimestamp());
      
      const isValid = await registry.verifyCredential(credHash);
      expect(isValid).to.be.true;
    });

    it("Should fail to issue expired credential", async function () {
      const credHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-cred"));
      const expiresAt = Math.floor(Date.now() / 1000) - 1; // Already expired
      
      await expect(
        registry.connect(issuer).issueCredential(
          user1.address,
          credHash,
          "MandateVC",
          expiresAt
        )
      ).to.be.revertedWith("CAIRegistry: invalid expiration");
    });

    it("Should revoke credential", async function () {
      const credHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-cred"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;
      
      await registry.connect(issuer).issueCredential(
        user1.address,
        credHash,
        "MandateVC",
        expiresAt
      );
      
      await expect(registry.connect(issuer).revokeCredential(credHash))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(credHash, await getBlockTimestamp());
      
      const isValid = await registry.verifyCredential(credHash);
      expect(isValid).to.be.false;
    });

    it("Should fail verification for inactive DID", async function () {
      const credHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-cred"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;
      
      await registry.connect(issuer).issueCredential(
        user1.address,
        credHash,
        "MandateVC",
        expiresAt
      );
      
      await registry.connect(user1).revokeDID(user1.address);
      
      const isValid = await registry.verifyCredential(credHash);
      expect(isValid).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should add trusted issuer", async function () {
      await expect(registry.addTrustedIssuer(issuer.address))
        .to.emit(registry, "TrustedIssuerAdded")
        .withArgs(issuer.address);
      
      expect(await registry.trustedIssuers(issuer.address)).to.be.true;
    });

    it("Should fail to issue credential as untrusted issuer", async function () {
      await registry.connect(user1).registerDID("ipfs://QmUser1");
      const credHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(
        registry.connect(user2).issueCredential(
          user1.address,
          credHash,
          "MandateVC",
          expiresAt
        )
      ).to.be.revertedWith("CAIRegistry: not trusted issuer");
    });
  });
});

// ============================================================================
// File: contracts/test/AHINAnchor.test.js
// ============================================================================

describe("AHINAnchor", function () {
  let anchor;
  let owner, authorized, user;

  beforeEach(async function () {
    [owner, authorized, user] = await ethers.getSigners();
    
    const AHINAnchor = await ethers.getContractFactory("AHINAnchor");
    anchor = await AHINAnchor.deploy();
    await anchor.deployed();
    
    await anchor.addAuthorizedAnchor(authorized.address);
  });

  describe("Block Anchoring", function () {
    it("Should anchor a block", async function () {
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-root"));
      const metadata = "ipfs://QmTestAudit";
      
      await expect(
        anchor.connect(authorized).anchorBlock(merkleRoot, 5, metadata)
      ).to.emit(anchor, "BlockAnchored")
        .withArgs(1, merkleRoot, 5, authorized.address);
      
      const block = await anchor.getBlock(1);
      expect(block.merkleRoot).to.equal(merkleRoot);
      expect(block.transactionCount).to.equal(5);
      expect(block.metadataURI).to.equal(metadata);
    });

    it("Should fail to anchor with zero transactions", async function () {
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      
      await expect(
        anchor.connect(authorized).anchorBlock(merkleRoot, 0, "ipfs://test")
      ).to.be.revertedWith("AHINAnchor: zero transactions");
    });

    it("Should fail unauthorized anchoring", async function () {
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      
      await expect(
        anchor.connect(user).anchorBlock(merkleRoot, 1, "ipfs://test")
      ).to.be.revertedWith("AHINAnchor: not authorized");
    });

    it("Should maintain block chain linkage", async function () {
      const root1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("root1"));
      const root2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("root2"));
      
      await anchor.connect(authorized).anchorBlock(root1, 1, "ipfs://1");
      await anchor.connect(authorized).anchorBlock(root2, 1, "ipfs://2");
      
      const block2 = await anchor.getBlock(2);
      const block1 = await anchor.getBlock(1);
      
      const expectedPrevHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes32", "uint256"],
          [block1.merkleRoot, block1.timestamp]
        )
      );
      
      expect(block2.prevBlockHash).to.equal(expectedPrevHash);
    });
  });

  describe("Transaction Verification", function () {
    it("Should verify transaction with valid proof", async function () {
      // Create a simple Merkle tree: [tx1, tx2]
      const tx1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("tx1"));
      const tx2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("tx2"));
      
      const merkleRoot = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "bytes32"], 
          tx1 < tx2 ? [tx1, tx2] : [tx2, tx1]
        )
      );
      
      await anchor.connect(authorized).anchorBlock(merkleRoot, 2, "ipfs://test");
      
      // Verify tx1 with proof [tx2]
      const proof = [tx2];
      const isValid = await anchor.verifyTransaction(1, tx1, proof);
      expect(isValid).to.be.true;
    });

    it("Should fail verification with invalid proof", async function () {
      const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("root"));
      await anchor.connect(authorized).anchorBlock(merkleRoot, 1, "ipfs://test");
      
      const fakeTx = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake"));
      const fakeProof = [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("proof"))];
      
      const isValid = await anchor.verifyTransaction(1, fakeTx, fakeProof);
      expect(isValid).to.be.false;
    });
  });

  describe("Chain Integrity", function () {
    it("Should verify chain integrity", async function () {
      for (let i = 0; i < 3; i++) {
        const root = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`root${i}`));
        await anchor.connect(authorized).anchorBlock(root, 1, `ipfs://${i}`);
      }
      
      const isIntact = await anchor.verifyChainIntegrity(1, 3);
      expect(isIntact).to.be.true;
    });
  });
});

// ============================================================================
// File: contracts/test/ERC8004Agent.test.js
// ============================================================================

describe("ERC8004Agent", function () {
  let registry, anchor, agent;
  let owner, agentAddr, merchant, user;

  beforeEach(async function () {
    [owner, agentAddr, merchant, user] = await ethers.getSigners();
    
    // Deploy CAIRegistry
    const CAIRegistry = await ethers.getContractFactory("CAIRegistry");
    registry = await CAIRegistry.deploy();
    await registry.deployed();
    
    // Deploy AHINAnchor
    const AHINAnchor = await ethers.getContractFactory("AHINAnchor");
    anchor = await AHINAnchor.deploy();
    await anchor.deployed();
    
    // Deploy ERC8004Agent
    const ERC8004Agent = await ethers.getContractFactory("ERC8004Agent");
    agent = await ERC8004Agent.deploy(registry.address, anchor.address);
    await agent.deployed();
    
    // Setup: Register agent DID
    await registry.connect(agentAddr).registerDID("ipfs://QmAgent");
  });

  describe("Transaction Initiation", function () {
    it("Should initiate transaction", async function () {
      const amount = ethers.utils.parseEther("1.0");
      const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart123"));
      const mandateSig = ethers.utils.toUtf8Bytes("signed-mandate");
      
      await expect(
        agent.connect(user).initiateTransaction(
          agentAddr.address,
          merchant.address,
          amount,
          cartHash,
          mandateSig
        )
      ).to.emit(agent, "TransactionInitiated");
      
      expect(await agent.totalTransactions()).to.equal(1);
    });

    it("Should fail with unregistered agent", async function () {
      const amount = ethers.utils.parseEther("1.0");
      const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart"));
      const mandateSig = ethers.utils.toUtf8Bytes("signed-mandate");
      
      await expect(
        agent.connect(user).initiateTransaction(
          user.address, // Unregistered agent
          merchant.address,
          amount,
          cartHash,
          mandateSig
        )
      ).to.be.revertedWith("ERC8004: invalid agent DID");
    });
  });

  describe("Transaction Completion", function () {
    let txId;

    beforeEach(async function () {
      const amount = ethers.utils.parseEther("1.0");
      const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart123"));
      const mandateSig = ethers.utils.toUtf8Bytes("signed-mandate");
      
      const tx = await agent.connect(user).initiateTransaction(
        agentAddr.address,
        merchant.address,
        amount,
        cartHash,
        mandateSig
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "TransactionInitiated");
      txId = event.args.transactionId;
    });

    it("Should complete transaction", async function () {
      const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt123"));
      const receiptSig = ethers.utils.toUtf8Bytes("signed-receipt");
      
      await expect(
        agent.connect(agentAddr).completeTransaction(txId, receiptHash, receiptSig)
      ).to.emit(agent, "TransactionCompleted")
        .withArgs(txId, receiptHash, await getBlockTimestamp());
      
      const txData = await agent.getTransaction(txId);
      expect(txData.receiptHash).to.equal(receiptHash);
      expect(txData.status).to.equal(1); // Completed
    });

    it("Should fail unauthorized completion", async function () {
      const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt"));
      const receiptSig = ethers.utils.toUtf8Bytes("signature");
      
      await expect(
        agent.connect(user).completeTransaction(txId, receiptHash, receiptSig)
      ).to.be.revertedWith("ERC8004: unauthorized completion");
    });

    it("Should fail with invalid receipt", async function () {
      const receiptHash = ethers.constants.HashZero;
      const receiptSig = ethers.utils.toUtf8Bytes("signature");
      
      await expect(
        agent.connect(agentAddr).completeTransaction(txId, receiptHash, receiptSig)
      ).to.be.revertedWith("ERC8004: invalid receipt");
    });
  });

  describe("Transaction Dispute", function () {
    let txId;

    beforeEach(async function () {
      const amount = ethers.utils.parseEther("1.0");
      const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart123"));
      const mandateSig = ethers.utils.toUtf8Bytes("signed-mandate");
      
      const tx = await agent.connect(user).initiateTransaction(
        agentAddr.address,
        merchant.address,
        amount,
        cartHash,
        mandateSig
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "TransactionInitiated");
      txId = event.args.transactionId;
    });

    it("Should dispute transaction", async function () {
      const reason = "Wrong amount charged";
      
      await expect(
        agent.connect(user).disputeTransaction(txId, reason)
      ).to.emit(agent, "TransactionDisputed")
        .withArgs(txId, user.address, reason);
      
      const txData = await agent.getTransaction(txId);
      expect(txData.status).to.equal(2); // Disputed
    });

    it("Should fail unauthorized dispute", async function () {
      await expect(
        agent.connect(agentAddr).disputeTransaction(txId, "reason")
      ).to.be.revertedWith("ERC8004: unauthorized dispute");
    });
  });

  describe("Integration with AHIN", function () {
    it("Should verify transaction integrity", async function () {
      // Initialize transaction
      const amount = ethers.utils.parseEther("1.0");
      const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart123"));
      const mandateSig = ethers.utils.toUtf8Bytes("signed-mandate");
      
      const tx = await agent.connect(user).initiateTransaction(
        agentAddr.address,
        merchant.address,
        amount,
        cartHash,
        mandateSig
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "TransactionInitiated");
      const txId = event.args.transactionId;
      
      // Complete transaction
      const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt"));
      const receiptSig = ethers.utils.toUtf8Bytes("signature");
      await agent.connect(agentAddr).completeTransaction(txId, receiptHash, receiptSig);
      
      // Anchor to AHIN
      await anchor.addAuthorizedAnchor(owner.address);
      const txHash = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["bytes32", "bytes32", "bytes32"],
          [txId, cartHash, receiptHash]
        )
      );
      
      const merkleRoot = txHash; // Single transaction tree
      await anchor.anchorBlock(merkleRoot, 1, "ipfs://audit");
      
      // Verify
      const proof = [];
      const isValid = await agent.verifyTransactionIntegrity(1, txId, proof);
      expect(isValid).to.be.true;
    });
  });
});

// ============================================================================
// File: contracts/test/smoke.test.js (Quick Smoke Tests)
// ============================================================================

describe("Smoke Tests - Quick Deployment Verification", function () {
  it("Should deploy all contracts successfully", async function () {
    const [deployer] = await ethers.getSigners();
    
    // Deploy CAIRegistry
    const CAIRegistry = await ethers.getContractFactory("CAIRegistry");
    const registry = await CAIRegistry.deploy();
    await registry.deployed();
    expect(registry.address).to.be.properAddress;
    
    // Deploy AHINAnchor
    const AHINAnchor = await ethers.getContractFactory("AHINAnchor");
    const anchor = await AHINAnchor.deploy();
    await anchor.deployed();
    expect(anchor.address).to.be.properAddress;
    
    // Deploy ERC8004Agent
    const ERC8004Agent = await ethers.getContractFactory("ERC8004Agent");
    const agent = await ERC8004Agent.deploy(registry.address, anchor.address);
    await agent.deployed();
    expect(agent.address).to.be.properAddress;
    
    console.log("\n✅ All contracts deployed successfully:");
    console.log("   CAIRegistry:", registry.address);
    console.log("   AHINAnchor:", anchor.address);
    console.log("   ERC8004Agent:", agent.address);
  });

  it("Should perform end-to-end transaction flow", async function () {
    const [deployer, agent, merchant, user] = await ethers.getSigners();
    
    // Deploy contracts
    const CAIRegistry = await ethers.getContractFactory("CAIRegistry");
    const registry = await CAIRegistry.deploy();
    await registry.deployed();
    
    const AHINAnchor = await ethers.getContractFactory("AHINAnchor");
    const anchor = await AHINAnchor.deploy();
    await anchor.deployed();
    
    const ERC8004Agent = await ethers.getContractFactory("ERC8004Agent");
    const agentContract = await ERC8004Agent.deploy(registry.address, anchor.address);
    await agentContract.deployed();
    
    // Register agent DID
    await registry.connect(agent).registerDID("ipfs://QmAgentDID");
    
    // Initiate transaction
    const amount = ethers.utils.parseEther("1.0");
    const cartHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cart"));
    const mandateSig = ethers.utils.toUtf8Bytes("mandate");
    
    const tx = await agentContract.connect(user).initiateTransaction(
      agent.address,
      merchant.address,
      amount,
      cartHash,
      mandateSig
    );
    
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "TransactionInitiated");
    const txId = event.args.transactionId;
    
    // Complete transaction
    const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt"));
    const receiptSig = ethers.utils.toUtf8Bytes("signature");
    
    await agentContract.connect(agent).completeTransaction(
      txId,
      receiptHash,
      receiptSig
    );
    
    // Verify transaction status
    const txData = await agentContract.getTransaction(txId);
    expect(txData.status).to.equal(1); // Completed
    
    console.log("\n✅ End-to-end flow completed:");
    console.log("   Transaction ID:", txId);
    console.log("   Status: Completed");
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function getBlockTimestamp() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
}

// Export for use in other test files
module.exports = {
  getBlockTimestamp
};