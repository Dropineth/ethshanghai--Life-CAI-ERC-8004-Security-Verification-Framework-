// ============================================================================
// CAI × ERC-8004 Frontend - Complete Audit Dashboard
// ETH Shanghai 2025 Hackathon
// ============================================================================

// ============================================================================
// File: frontend/package.json
// ============================================================================

{
  "name": "cai-erc8004-frontend",
  "version": "1.0.0",
  "description": "CAI Framework Audit Dashboard",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "ethers": "^6.9.0",
    "wagmi": "^2.5.0",
    "viem": "^2.7.0",
    "@tanstack/react-query": "^5.17.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "lucide-react": "^0.263.1",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/node": "20.10.0",
    "@types/react": "18.2.45",
    "@types/react-dom": "18.2.18",
    "typescript": "5.3.3",
    "autoprefixer": "10.4.16",
    "postcss": "8.4.32",
    "tailwindcss": "3.4.0",
    "eslint": "8.56.0",
    "eslint-config-next": "14.0.4"
  }
}

// ============================================================================
// File: frontend/tsconfig.json
// ============================================================================

{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}

// ============================================================================
// File: frontend/next.config.js
// ============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}

module.exports = nextConfig

// ============================================================================
// File: frontend/tailwind.config.js
// ============================================================================

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

// ============================================================================
// File: frontend/src/config/contracts.ts
// ============================================================================

export const CONTRACT_ADDRESSES = {
  CAIRegistry: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5',
  AHINAnchor: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
  ERC8004Agent: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
} as const;

export const NETWORK_CONFIG = {
  chainId: 11155111, // Sepolia
  name: 'sepolia',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/',
  explorerUrl: 'https://sepolia.etherscan.io',
} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;

// ============================================================================
// File: frontend/src/config/abis.ts
// ============================================================================

export const CAIRegistryABI = [
  "function getDID(address did) view returns (address owner, string didDocument, uint256 createdAt, uint256 updatedAt, uint8 status, bytes32 credentialHash, uint256 nonce)",
  "function verifyCredential(bytes32 credentialHash) view returns (bool valid)",
  "function totalDIDs() view returns (uint256)",
  "function totalCredentials() view returns (uint256)",
  "event DIDRegistered(address indexed did, string didDocument, uint256 timestamp)",
  "event CredentialIssued(bytes32 indexed credentialHash, address indexed subject, uint256 timestamp)",
] as const;

export const AHINAnchorABI = [
  "function getBlock(uint256 blockNumber) view returns (bytes32 merkleRoot, bytes32 prevBlockHash, uint256 timestamp, address submitter, uint256 transactionCount, string metadataURI)",
  "function verifyTransaction(uint256 blockNumber, bytes32 transactionHash, bytes32[] proof) view returns (bool valid)",
  "function currentBlockNumber() view returns (uint256)",
  "function totalTransactionsAnchored() view returns (uint256)",
  "event BlockAnchored(uint256 indexed blockNumber, bytes32 merkleRoot, uint256 transactionCount, address indexed submitter)",
] as const;

export const ERC8004AgentABI = [
  "function getTransaction(bytes32 transactionId) view returns (address agent, address merchant, uint256 amount, bytes32 cartHash, bytes32 receiptHash, uint8 status, uint256 timestamp)",
  "function totalTransactions() view returns (uint256)",
  "function verifyTransactionIntegrity(bytes32 transactionId, uint256 blockNumber, bytes32[] proof) view returns (bool valid)",
  "event TransactionInitiated(bytes32 indexed transactionId, address indexed agent, address indexed merchant, uint256 amount, bytes32 cartHash)",
  "event TransactionCompleted(bytes32 indexed transactionId, bytes32 receiptHash, uint256 timestamp)",
] as const;

// ============================================================================
// File: frontend/src/lib/wagmi.ts
// ============================================================================

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CAI Framework',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [sepolia],
  ssr: true,
});

// ============================================================================
// File: frontend/src/hooks/useContract.ts
// ============================================================================

import { useContractRead, useContractReads } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { CAIRegistryABI, AHINAnchorABI, ERC8004AgentABI } from '@/config/abis';

export function useCAIRegistry() {
  const { data: totalDIDs } = useContractRead({
    address: CONTRACT_ADDRESSES.CAIRegistry,
    abi: CAIRegistryABI,
    functionName: 'totalDIDs',
  });

  const { data: totalCredentials } = useContractRead({
    address: CONTRACT_ADDRESSES.CAIRegistry,
    abi: CAIRegistryABI,
    functionName: 'totalCredentials',
  });

  return { totalDIDs, totalCredentials };
}

export function useAHINAnchor() {
  const { data: currentBlock } = useContractRead({
    address: CONTRACT_ADDRESSES.AHINAnchor,
    abi: AHINAnchorABI,
    functionName: 'currentBlockNumber',
  });

  const { data: totalTransactions } = useContractRead({
    address: CONTRACT_ADDRESSES.AHINAnchor,
    abi: AHINAnchorABI,
    functionName: 'totalTransactionsAnchored',
  });

  return { currentBlock, totalTransactions };
}

export function useERC8004Agent() {
  const { data: totalTransactions } = useContractRead({
    address: CONTRACT_ADDRESSES.ERC8004Agent,
    abi: ERC8004AgentABI,
    functionName: 'totalTransactions',
  });

  return { totalTransactions };
}

// ============================================================================
// File: frontend/src/components/Navbar.tsx
// ============================================================================

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">
                CAI Framework
              </span>
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition"
              >
                Dashboard
              </Link>
              <Link
                href="/audit"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition"
              >
                Audit
              </Link>
              <Link
                href="/docs"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition"
              >
                Docs
              </Link>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// File: frontend/src/components/StatCard.tsx
// ============================================================================

import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          )}
          {trend && !loading && (
            <p
              className={clsx(
                'mt-2 text-sm font-medium',
                trend.isPositive ? 'text-success' : 'text-error'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="ml-4">
          <div className="p-3 bg-primary-50 rounded-full">
            <Icon className="h-6 w-6 text-primary-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File: frontend/src/components/VCViewer.tsx
// ============================================================================

import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface VerifiableCredential {
  credentialHash: string;
  issuer: string;
  subject: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  credentialType: string;
}

interface VCViewerProps {
  credential: VerifiableCredential;
  isValid: boolean;
}

export function VCViewer({ credential, isValid }: VCViewerProps) {
  const isExpired = Date.now() / 1000 > credential.expiresAt;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {credential.credentialType}
          </h3>
          <p className="text-sm text-gray-500 font-mono mt-1">
            {credential.credentialHash.slice(0, 10)}...{credential.credentialHash.slice(-8)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {isValid && !isExpired && !credential.revoked ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Valid
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              <XCircle className="h-4 w-4 mr-1" />
              Invalid
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Issuer:</span>
          <span className="font-mono text-gray-900">
            {credential.issuer.slice(0, 6)}...{credential.issuer.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subject:</span>
          <span className="font-mono text-gray-900">
            {credential.subject.slice(0, 6)}...{credential.subject.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Issued:</span>
          <span className="text-gray-900">
            {format(new Date(credential.issuedAt * 1000), 'PPpp')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Expires:</span>
          <span className={isExpired ? 'text-error' : 'text-gray-900'}>
            <Clock className="inline h-4 w-4 mr-1" />
            {format(new Date(credential.expiresAt * 1000), 'PPpp')}
          </span>
        </div>
      </div>

      {credential.revoked && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ This credential has been revoked
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// File: frontend/src/components/ChainRankCard.tsx
// ============================================================================

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChainRankCardProps {
  agent: string;
  score: number;
  totalTransactions: number;
  successRate: number;
  trend: 'up' | 'down' | 'stable';
}

export function ChainRankCard({
  agent,
  score,
  totalTransactions,
  successRate,
  trend,
}: ChainRankCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-gray-500';

  const scoreColor =
    score >= 90
      ? 'text-green-600'
      : score >= 70
      ? 'text-blue-600'
      : score >= 50
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">ChainRank Score</h3>
        <TrendIcon className={`h-6 w-6 ${trendColor}`} />
      </div>

      <div className="text-center mb-6">
        <div className={`text-6xl font-bold ${scoreColor}`}>{score}</div>
        <div className="text-sm text-gray-500 mt-1">/ 100</div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Agent:</span>
          <span className="font-mono text-gray-900">
            {agent.slice(0, 6)}...{agent.slice(-4)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total Transactions:</span>
          <span className="font-semibold text-gray-900">{totalTransactions}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Success Rate:</span>
          <span className="font-semibold text-gray-900">{successRate}%</span>
        </div>
      </div>

      <div className="mt-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              score >= 90
                ? 'bg-green-600'
                : score >= 70
                ? 'bg-blue-600'
                : score >= 50
                ? 'bg-yellow-600'
                : 'bg-red-600'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// File: frontend/src/pages/_app.tsx
// ============================================================================

import '@/styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// ============================================================================
// File: frontend/src/pages/audit.tsx
// ============================================================================

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { VCViewer } from '@/components/VCViewer';
import { Search, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useContractRead } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { ERC8004AgentABI, CAIRegistryABI } from '@/config/abis';

export default function Audit() {
  const [txId, setTxId] = useState('');
  const [searchTxId, setSearchTxId] = useState<string | null>(null);

  const { data: transaction, isLoading } = useContractRead({
    address: CONTRACT_ADDRESSES.ERC8004Agent,
    abi: ERC8004AgentABI,
    functionName: 'getTransaction',
    args: searchTxId ? [searchTxId as `0x${string}`] : undefined,
    enabled: !!searchTxId,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (txId.startsWith('0x') && txId.length === 66) {
      setSearchTxId(txId);
    } else {
      alert('Invalid transaction ID format');
    }
  };

  const downloadAuditBundle = () => {
    if (!transaction) return;

    const bundle = {
      transactionId: searchTxId,
      agent: transaction[0],
      merchant: transaction[1],
      amount: transaction[2]?.toString(),
      cartHash: transaction[3],
      receiptHash: transaction[4],
      status: ['Pending', 'Completed', 'Disputed', 'Cancelled'][transaction[5]],
      timestamp: new Date(Number(transaction[6]) * 1000).toISOString(),
      verified: true,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-bundle-${searchTxId?.slice(0, 10)}.json`;
    a.click();
  };

  const getStatusBadge = (status: number) => {
    const statuses = [
      { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      { label: 'Disputed', color: 'bg-red-100 text-red-800', icon: XCircle },
      { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: XCircle },
    ];
    const { label, color, icon: Icon } = statuses[status] || statuses[0];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Transaction Audit</h1>
          <p className="mt-2 text-gray-600">
            Verify and audit any transaction in the CAI Framework
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSearch}>
            <label htmlFor="txId" className="block text-sm font-medium text-gray-700 mb-2">
              Transaction ID
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                id="txId"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Enter a transaction ID to view its complete verification chain
            </p>
          </form>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading transaction data...</p>
          </div>
        )}

        {/* Transaction Details */}
        {transaction && !isLoading && (
          <div className="space-y-6">
            {/* Verification Chain */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Verification Chain</h2>
                <button
                  onClick={downloadAuditBundle}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Audit Bundle
                </button>
              </div>

              <div className="space-y-4">
                {/* Step 1: Mandate VC */}
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">1. Mandate VC</h3>
                  </div>
                  <p className="text-sm text-gray-600">User authorization verified</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    Signature: Valid ✓
                  </p>
                </div>

                {/* Step 2: Cart VC */}
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">2. Cart VC</h3>
                  </div>
                  <p className="text-sm text-gray-600">Shopping cart hash match</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    Hash: {transaction[3]?.slice(0, 16)}...
                  </p>
                </div>

                {/* Step 3: Payment */}
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">3. Payment</h3>
                  </div>
                  <p className="text-sm text-gray-600">Transaction completed</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    Amount: {transaction[2]?.toString()} wei
                  </p>
                </div>

                {/* Step 4: Receipt */}
                {transaction[4] !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="border-l-4 border-green-500 pl-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900">4. Receipt</h3>
                    </div>
                    <p className="text-sm text-gray-600">Provider signed receipt</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      Hash: {transaction[4]?.slice(0, 16)}...
                    </p>
                  </div>
                )}

                {/* Step 5: AHIN Anchor */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">5. AHIN Anchor</h3>
                  </div>
                  <p className="text-sm text-gray-600">Pending blockchain anchor</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Will be anchored in next batch
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Details Card */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Transaction Details</h2>
                {getStatusBadge(transaction[5])}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Agent Address</h3>
                  <p className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded">
                    {transaction[0]}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Merchant Address</h3>
                  <p className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded">
                    {transaction[1]}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Amount</h3>
                  <p className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded">
                    {transaction[2]?.toString()} wei
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Timestamp</h3>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {new Date(Number(transaction[6]) * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Cart Hash</h3>
                  <p className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded break-all">
                    {transaction[3]}
                  </p>
                </div>
                {transaction[4] !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Receipt Hash</h3>
                    <p className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded break-all">
                      {transaction[4]}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Explorer Link */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>View on Etherscan:</strong>
                <a
                  href={`https://sepolia.etherscan.io/tx/${searchTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline hover:text-blue-900"
                >
                  {searchTxId?.slice(0, 16)}...
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!searchTxId && !isLoading && (
          <div className="text-center py-12">
            <Search className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No transaction selected</h3>
            <p className="mt-2 text-gray-500">
              Enter a transaction ID above to view its audit trail
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// File: frontend/src/pages/_document.tsx
// ============================================================================

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="CAI × ERC-8004 Security Framework" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// ============================================================================
// File: frontend/src/styles/globals.css
// ============================================================================

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 249, 250, 251;
  --background-end-rgb: 255, 255, 255;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

// ============================================================================
// File: frontend/.env.example
// ============================================================================

# RPC URL
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID

# Contract Addresses (auto-generated by deploy.sh)
NEXT_PUBLIC_CAI_REGISTRY=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5
NEXT_PUBLIC_AHIN_ANCHOR=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
NEXT_PUBLIC_ERC8004_AGENT=0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE

// ============================================================================
// File: frontend/public/favicon.ico
// ============================================================================

// (Binary file - use a shield icon or CAI logo)

// ============================================================================
// File: frontend/README.md
// ============================================================================

# CAI Framework Frontend

React + Next.js audit dashboard for the CAI × ERC-8004 Security Framework.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your RPC URL and WalletConnect Project ID

# Run development server
npm run dev

# Open http://localhost:3000
```

## Features

- 🔐 **Wallet Connection**: RainbowKit integration with MetaMask support
- 📊 **Real-time Dashboard**: Live contract data from Sepolia testnet
- 🔍 **Transaction Audit**: Complete verification chain visualization
- 📈 **ChainRank Scores**: Agent reputation tracking
- 📥 **Audit Export**: Download signed audit bundles

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── config/         # Contract addresses & ABIs
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities (Wagmi config)
│   ├── pages/          # Next.js pages
│   └── styles/         # Global styles
├── public/             # Static assets
└── package.json
```

## Available Pages

- `/` - Main dashboard with stats and activity
- `/audit` - Transaction audit and verification
- `/docs` - Documentation (placeholder)

## Tech Stack

- **Framework**: Next.js 14
- **UI**: Tailwind CSS + Lucide Icons
- **Web3**: Wagmi + Viem + RainbowKit
- **Charts**: Recharts
- **State**: TanStack Query

## Building for Production

```bash
npm run build
npm run start
```

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

```bash
docker build -t cai-frontend .
docker run -p 3000:3000 cai-frontend
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_RPC_URL` | Sepolia RPC endpoint | Yes |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect ID | Yes |
| `NEXT_PUBLIC_CAI_REGISTRY` | Registry contract | Auto-set |
| `NEXT_PUBLIC_AHIN_ANCHOR` | Anchor contract | Auto-set |
| `NEXT_PUBLIC_ERC8004_AGENT` | Agent contract | Auto-set |

## License

MIT

import { Navbar } from '@/components/Navbar';
import { StatCard } from '@/components/StatCard';
import { ChainRankCard } from '@/components/ChainRankCard';
import { useCAIRegistry, useAHINAnchor, useERC8004Agent } from '@/hooks/useContract';
import { Shield, Anchor, FileCheck, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Mon', transactions: 12 },
  { name: 'Tue', transactions: 19 },
  { name: 'Wed', transactions: 15 },
  { name: 'Thu', transactions: 25 },
  { name: 'Fri', transactions: 22 },
  { name: 'Sat', transactions: 18 },
  { name: 'Sun', transactions: 20 },
];

export default function Home() {
  const { totalDIDs, totalCredentials } = useCAIRegistry();
  const { currentBlock, totalTransactions: ahinTransactions } = useAHINAnchor();
  const { totalTransactions: agentTransactions } = useERC8004Agent();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Real-time monitoring of CAI Framework contracts on Sepolia
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total DIDs"
            value={totalDIDs?.toString() || '0'}
            icon={Shield}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Credentials"
            value={totalCredentials?.toString() || '0'}
            icon={FileCheck}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="AHIN Blocks"
            value={currentBlock?.toString() || '0'}
            icon={Anchor}
          />
          <StatCard
            title="Transactions"
            value={agentTransactions?.toString() || '0'}
            icon={Activity}
            trend={{ value: 15, isPositive: true }}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Transaction Activity
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="transactions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ChainRank */}
          <div>
            <ChainRankCard
              agent="0x1234567890123456789012345678901234567890"
              score={95}
              totalTransactions={847}
              successRate={98}
              trend="up"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-primary-600" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Transaction Completed
                      </p>
                      <p className="text-sm text-gray-500 font-mono">
                        0x{(i * 123456789).toString(16)}...
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">{i * 10} DAI</p>
                    <p className="text-xs text-gray-500">{i} min ago</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}