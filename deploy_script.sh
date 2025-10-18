#!/bin/bash

# ============================================================================
# CAI × ERC-8004 Framework - 一键部署脚本
# ETH Shanghai 2025 Hackathon
# ============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
NETWORK=${NETWORK:-sepolia}
DEPLOY_LOG="deployments/${NETWORK}_$(date +%Y%m%d_%H%M%S).log"
DEPLOYMENT_FILE="deployments/${NETWORK}.json"

# ============================================================================
# 工具函数
# ============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================"
    echo "$1"
    echo "============================================================================"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================================================
# 前置检查
# ============================================================================

check_prerequisites() {
    print_header "检查前置条件"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "未找到 Node.js，请先安装 Node.js >= 18"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "未找到 npm"
        exit 1
    fi
    print_success "npm: $(npm --version)"
    
    # 检查 Git
    if ! command -v git &> /dev/null; then
        print_warning "未找到 Git (可选)"
    else
        print_success "Git: $(git --version)"
    fi
    
    # 检查 .env 文件
    if [ ! -f "contracts/.env" ]; then
        print_error "未找到 contracts/.env 文件"
        print_info "请复制 contracts/.env.example 并填入配置"
        exit 1
    fi
    print_success "环境配置文件存在"
    
    # 加载环境变量
    source contracts/.env
    
    # 检查必需的环境变量
    if [ -z "$PRIVATE_KEY" ]; then
        print_error "未设置 PRIVATE_KEY 环境变量"
        exit 1
    fi
    
    if [ -z "$SEPOLIA_RPC_URL" ] && [ "$NETWORK" = "sepolia" ]; then
        print_error "未设置 SEPOLIA_RPC_URL 环境变量"
        exit 1
    fi
    
    print_success "环境变量配置完整"
    echo ""
}

# ============================================================================
# 安装依赖
# ============================================================================

install_dependencies() {
    print_header "安装项目依赖"
    
    cd contracts
    
    if [ ! -d "node_modules" ]; then
        print_info "首次安装依赖，可能需要几分钟..."
        npm install
        print_success "依赖安装完成"
    else
        print_info "检查依赖更新..."
        npm ci --quiet
        print_success "依赖已是最新"
    fi
    
    cd ..
    echo ""
}

# ============================================================================
# 编译合约
# ============================================================================

compile_contracts() {
    print_header "编译智能合约"
    
    cd contracts
    
    print_info "清理旧编译文件..."
    npx hardhat clean
    
    print_info "开始编译..."
    npx hardhat compile
    
    if [ $? -eq 0 ]; then
        print_success "合约编译成功"
        
        # 显示编译统计
        CONTRACT_COUNT=$(find artifacts/contracts -name "*.json" ! -name "*.dbg.json" | wc -l)
        print_info "共编译 $CONTRACT_COUNT 个合约"
    else
        print_error "合约编译失败"
        exit 1
    fi
    
    cd ..
    echo ""
}

# ============================================================================
# 部署合约
# ============================================================================

deploy_contracts() {
    print_header "部署合约到 ${NETWORK} 网络"
    
    cd contracts
    
    # 创建部署日志目录
    mkdir -p ../deployments
    
    print_info "开始部署流程..."
    echo "网络: $NETWORK" | tee -a "../${DEPLOY_LOG}"
    echo "时间: $(date)" | tee -a "../${DEPLOY_LOG}"
    echo "" | tee -a "../${DEPLOY_LOG}"
    
    # 部署 CAIRegistry
    print_info "1/3 部署 CAIRegistry (DID 注册表)..."
    REGISTRY_ADDRESS=$(npx hardhat run scripts/deploy-registry.js --network $NETWORK | grep "CAIRegistry deployed to:" | awk '{print $4}')
    
    if [ -z "$REGISTRY_ADDRESS" ]; then
        print_error "CAIRegistry 部署失败"
        exit 1
    fi
    print_success "CAIRegistry 部署成功: $REGISTRY_ADDRESS"
    echo "CAIRegistry: $REGISTRY_ADDRESS" | tee -a "../${DEPLOY_LOG}"
    
    sleep 5  # 等待区块确认
    
    # 部署 AHINAnchor
    print_info "2/3 部署 AHINAnchor (哈希链锚定)..."
    ANCHOR_ADDRESS=$(npx hardhat run scripts/deploy-anchor.js --network $NETWORK | grep "AHINAnchor deployed to:" | awk '{print $4}')
    
    if [ -z "$ANCHOR_ADDRESS" ]; then
        print_error "AHINAnchor 部署失败"
        exit 1
    fi
    print_success "AHINAnchor 部署成功: $ANCHOR_ADDRESS"
    echo "AHINAnchor: $ANCHOR_ADDRESS" | tee -a "../${DEPLOY_LOG}"
    
    sleep 5
    
    # 部署 ERC8004Agent
    print_info "3/3 部署 ERC8004Agent (Agent 商业接口)..."
    AGENT_ADDRESS=$(REGISTRY_ADDRESS=$REGISTRY_ADDRESS ANCHOR_ADDRESS=$ANCHOR_ADDRESS npx hardhat run scripts/deploy-agent.js --network $NETWORK | grep "ERC8004Agent deployed to:" | awk '{print $4}')
    
    if [ -z "$AGENT_ADDRESS" ]; then
        print_error "ERC8004Agent 部署失败"
        exit 1
    fi
    print_success "ERC8004Agent 部署成功: $AGENT_ADDRESS"
    echo "ERC8004Agent: $AGENT_ADDRESS" | tee -a "../${DEPLOY_LOG}"
    
    cd ..
    echo ""
    
    # 保存部署信息为 JSON
    save_deployment_info "$REGISTRY_ADDRESS" "$ANCHOR_ADDRESS" "$AGENT_ADDRESS"
}

# ============================================================================
# 保存部署信息
# ============================================================================

save_deployment_info() {
    local registry=$1
    local anchor=$2
    local agent=$3
    
    print_header "保存部署信息"
    
    cat > "$DEPLOYMENT_FILE" <<EOF
{
  "network": "$NETWORK",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo 'N/A')",
  "contracts": {
    "CAIRegistry": {
      "address": "$registry",
      "explorerUrl": "https://${NETWORK}.etherscan.io/address/$registry"
    },
    "AHINAnchor": {
      "address": "$anchor",
      "explorerUrl": "https://${NETWORK}.etherscan.io/address/$anchor"
    },
    "ERC8004Agent": {
      "address": "$agent",
      "explorerUrl": "https://${NETWORK}.etherscan.io/address/$agent"
    }
  }
}
EOF
    
    print_success "部署信息已保存到: $DEPLOYMENT_FILE"
    print_info "完整日志: $DEPLOY_LOG"
    echo ""
}

# ============================================================================
# 验证合约
# ============================================================================

verify_contracts() {
    print_header "验证合约源码 (可选)"
    
    read -p "是否在 Etherscan 上验证合约？(y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "跳过合约验证"
        return
    fi
    
    if [ -z "$ETHERSCAN_API_KEY" ]; then
        print_error "未设置 ETHERSCAN_API_KEY，无法验证"
        return
    fi
    
    cd contracts
    
    # 读取部署地址
    source ../$DEPLOYMENT_FILE
    REGISTRY_ADDR=$(jq -r '.contracts.CAIRegistry.address' ../$DEPLOYMENT_FILE)
    ANCHOR_ADDR=$(jq -r '.contracts.AHINAnchor.address' ../$DEPLOYMENT_FILE)
    AGENT_ADDR=$(jq -r '.contracts.ERC8004Agent.address' ../$DEPLOYMENT_FILE)
    
    print_info "验证 CAIRegistry..."
    npx hardhat verify --network $NETWORK $REGISTRY_ADDR || print_warning "验证失败或已验证"
    
    print_info "验证 AHINAnchor..."
    npx hardhat verify --network $NETWORK $ANCHOR_ADDR || print_warning "验证失败或已验证"
    
    print_info "验证 ERC8004Agent..."
    npx hardhat verify --network $NETWORK $AGENT_ADDR $REGISTRY_ADDR $ANCHOR_ADDR || print_warning "验证失败或已验证"
    
    cd ..
    echo ""
}

# ============================================================================
# 初始化配置
# ============================================================================

initialize_contracts() {
    print_header "初始化合约配置"
    
    cd contracts
    
    print_info "设置合约权限与初始参数..."
    npx hardhat run scripts/initialize.js --network $NETWORK
    
    if [ $? -eq 0 ]; then
        print_success "合约初始化完成"
    else
        print_warning "初始化失败，请手动配置"
    fi
    
    cd ..
    echo ""
}

# ============================================================================
# 部署后测试
# ============================================================================

run_smoke_tests() {
    print_header "运行冒烟测试"
    
    cd contracts
    
    print_info "测试基本功能..."
    npx hardhat test test/smoke.test.js --network $NETWORK
    
    if [ $? -eq 0 ]; then
        print_success "冒烟测试通过 ✓"
    else
        print_error "冒烟测试失败"
        print_warning "合约已部署但可能存在问题，请检查日志"
    fi
    
    cd ..
    echo ""
}

# ============================================================================
# 生成前端配置
# ============================================================================

generate_frontend_config() {
    print_header "生成前端配置文件"
    
    if [ ! -d "frontend" ]; then
        print_warning "前端目录不存在，跳过配置生成"
        return
    fi
    
    # 读取合约地址
    REGISTRY_ADDR=$(jq -r '.contracts.CAIRegistry.address' $DEPLOYMENT_FILE)
    ANCHOR_ADDR=$(jq -r '.contracts.AHINAnchor.address' $DEPLOYMENT_FILE)
    AGENT_ADDR=$(jq -r '.contracts.ERC8004Agent.address' $DEPLOYMENT_FILE)
    
    # 生成 TypeScript 配置文件
    cat > frontend/src/config/contracts.ts <<EOF
// Auto-generated by deploy.sh on $(date)
// DO NOT EDIT MANUALLY

export const CONTRACT_ADDRESSES = {
  CAIRegistry: '$REGISTRY_ADDR',
  AHINAnchor: '$ANCHOR_ADDR',
  ERC8004Agent: '$AGENT_ADDR',
} as const;

export const NETWORK_CONFIG = {
  chainId: $([ "$NETWORK" = "sepolia" ] && echo "11155111" || echo "1"),
  name: '$NETWORK',
  rpcUrl: '${SEPOLIA_RPC_URL}',
  explorerUrl: 'https://${NETWORK}.etherscan.io',
} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;
EOF
    
    print_success "前端配置已生成: frontend/src/config/contracts.ts"
    echo ""
}

# ============================================================================
# 生成后端配置
# ============================================================================

generate_backend_config() {
    print_header "生成后端配置文件"
    
    if [ ! -d "backend" ]; then
        print_warning "后端目录不存在，跳过配置生成"
        return
    fi
    
    # 读取合约地址
    REGISTRY_ADDR=$(jq -r '.contracts.CAIRegistry.address' $DEPLOYMENT_FILE)
    ANCHOR_ADDR=$(jq -r '.contracts.AHINAnchor.address' $DEPLOYMENT_FILE)
    AGENT_ADDR=$(jq -r '.contracts.ERC8004Agent.address' $DEPLOYMENT_FILE)
    
    # 更新 .env 文件
    cat > backend/.env.deployment <<EOF
# Auto-generated deployment config
NETWORK=$NETWORK
CAI_REGISTRY_ADDRESS=$REGISTRY_ADDR
AHIN_ANCHOR_ADDRESS=$ANCHOR_ADDR
ERC8004_AGENT_ADDRESS=$AGENT_ADDR
RPC_URL=${SEPOLIA_RPC_URL}
DEPLOYMENT_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
    
    print_success "后端配置已生成: backend/.env.deployment"
    print_info "请将配置合并到 backend/.env 文件中"
    echo ""
}

# ============================================================================
# 显示部署摘要
# ============================================================================

show_deployment_summary() {
    print_header "🎉 部署完成！"
    
    echo -e "${GREEN}"
    cat <<EOF
╔════════════════════════════════════════════════════════════════════════╗
║                   CAI × ERC-8004 部署成功                               ║
╚════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    # 读取并显示合约地址
    echo "📍 合约地址:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    REGISTRY_ADDR=$(jq -r '.contracts.CAIRegistry.address' $DEPLOYMENT_FILE)
    ANCHOR_ADDR=$(jq -r '.contracts.AHINAnchor.address' $DEPLOYMENT_FILE)
    AGENT_ADDR=$(jq -r '.contracts.ERC8004Agent.address' $DEPLOYMENT_FILE)
    
    echo -e "${BLUE}CAIRegistry:${NC}     $REGISTRY_ADDR"
    echo -e "                  https://${NETWORK}.etherscan.io/address/$REGISTRY_ADDR"
    echo ""
    echo -e "${BLUE}AHINAnchor:${NC}      $ANCHOR_ADDR"
    echo -e "                  https://${NETWORK}.etherscan.io/address/$ANCHOR_ADDR"
    echo ""
    echo -e "${BLUE}ERC8004Agent:${NC}    $AGENT_ADDR"
    echo -e "                  https://${NETWORK}.etherscan.io/address/$AGENT_ADDR"
    echo ""
    
    echo "📁 部署文件:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  • 部署信息: $DEPLOYMENT_FILE"
    echo "  • 详细日志: $DEPLOY_LOG"
    echo ""
    
    echo "🚀 下一步操作:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  1. 启动后端服务:"
    echo "     cd backend && npm install && npm run dev"
    echo ""
    echo "  2. 启动前端应用:"
    echo "     cd frontend && npm install && npm run dev"
    echo ""
    echo "  3. 运行完整测试:"
    echo "     ./scripts/test.sh"
    echo ""
    echo "  4. 查看部署信息:"
    echo "     cat $DEPLOYMENT_FILE"
    echo ""
    
    print_success "所有组件已就绪，开始构建你的 AI Agent 商业应用！"
    echo ""
}

# ============================================================================
# 错误处理
# ============================================================================

cleanup_on_error() {
    print_error "部署过程中出现错误"
    print_info "日志已保存到: $DEPLOY_LOG"
    print_info "请检查错误信息并重新运行脚本"
    exit 1
}

trap cleanup_on_error ERR

# ============================================================================
# 主函数
# ============================================================================

main() {
    echo ""
    print_header "CAI × ERC-8004 Framework 部署脚本"
    echo "目标网络: $NETWORK"
    echo "开始时间: $(date)"
    echo ""
    
    # 执行部署流程
    check_prerequisites
    install_dependencies
    compile_contracts
    deploy_contracts
    verify_contracts
    initialize_contracts
    run_smoke_tests
    generate_frontend_config
    generate_backend_config
    show_deployment_summary
    
    # 记录总耗时
    SECONDS=0
    echo ""
    print_info "总耗时: ${SECONDS}秒"
    echo ""
}

# ============================================================================
# 运行主函数
# ============================================================================

main "$@"