export function toWidgetNetwork(n) {
  const chainId =
    n.ecosystem === "evm" ? n.chainId : `${n.ecosystem}:${n.environment}`;
  return {
    key: n.key,
    name: n.name,
    chainId,
    rpcUrl: n.publicRpcUrl,
    contractAddress: n.contractAddress,
    registryObjectId: n.registryObjectId,
    logo: n.logoUrl,
    explorer: n.explorerTxUrl,
    type: n.environment,
    ecosystem: n.ecosystem,
    nativeSymbol: n.nativeSymbol,
    networkPassphrase: n.networkPassphrase,
    platformFeeBps: n.platformFeeBps,
  };
}

export function toWidgetTokens(n) {
  return n.tokens.map((t) => ({
    symbol: t.symbol,
    displaySymbol: t.displaySymbol,
    name: t.name,
    icon: t.logoUrl,
    address: t.address,
    decimals: t.decimals,
    isNative: t.isNative,
  }));
}

export function indexCatalog(networks) {
  const byKey = {};
  for (const n of networks) {
    byKey[n.key] = { network: toWidgetNetwork(n), tokens: toWidgetTokens(n) };
  }
  return byKey;
}
