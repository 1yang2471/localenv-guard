const PROTECTED_PATTERNS = [
  ["MySQL", /\b(mysqld|mysql)\b/i],
  ["PostgreSQL", /\b(postgres|postmaster|postgresql)\b/i],
  ["Redis", /\b(redis-server|redis)\b/i],
  ["MongoDB", /\b(mongod|mongodb)\b/i],
  ["Nginx", /\b(nginx)\b/i],
  ["Apache", /\b(apache2|httpd)\b/i],
  ["Docker", /\b(dockerd|docker\s+daemon|com\.docker|docker desktop)\b/i],
  ["SSH", /\b(sshd|ssh-agent)\b/i],
  ["Windows 系统服务", /\b(svchost|services|lsass|wininit|smss|csrss|winlogon)\.exe\b/i],
  ["Unix 系统服务", /\b(systemd|launchd|kernel_task|init)\b/i],
  ["Elasticsearch", /\b(elasticsearch)\b/i],
  ["RabbitMQ", /\b(rabbitmq|beam\.smp)\b/i],
  ["Kafka", /\b(kafka|zookeeper)\b/i]
  , ["MariaDB", /\b(mariadbd|mariadb)\b/i]
  , ["Microsoft SQL Server", /\b(sqlservr|sqlserver)\b/i]
  , ["Oracle", /\b(oracle|tnslsnr)\b/i]
  , ["CockroachDB", /\b(cockroach)\b/i]
  , ["Cassandra", /\b(cassandra)\b/i]
  , ["Memcached", /\b(memcached)\b/i]
  , ["CouchDB", /\b(couchdb)\b/i]
  , ["Neo4j", /\b(neo4j)\b/i]
  , ["InfluxDB", /\b(influxd|influxdb)\b/i]
  , ["ClickHouse", /\b(clickhouse)\b/i]
  , ["Firebird", /\b(firebird|fbserver)\b/i]
  , ["OpenSearch", /\b(opensearch)\b/i]
  , ["Solr", /\b(solr)\b/i]
  , ["ActiveMQ", /\b(activemq)\b/i]
  , ["NATS", /\b(nats-server|nats)\b/i]
  , ["Pulsar", /\b(pulsar)\b/i]
  , ["Mosquitto", /\b(mosquitto)\b/i]
  , ["etcd", /\b(etcd)\b/i]
  , ["Consul", /\b(consul)\b/i]
  , ["Vault", /\b(vault)\b/i]
  , ["MinIO", /\b(minio)\b/i]
  , ["容器运行时", /\b(containerd|crio|podman)\b/i]
  , ["Kubernetes", /\b(kubelet|kube-apiserver|kube-proxy|k3s|microk8s)\b/i]
  , ["反向代理", /\b(caddy|traefik|haproxy|envoy)\b/i]
  , ["IIS", /\b(w3wp|inetinfo)\.exe\b/i]
  , ["Windows 安全服务", /\b(msmpeng|nissrv|securityhealthservice|sense)\.exe\b/i]
  , ["Unix 系统守护", /\b(dbus-daemon|systemd-journald|networkmanager)\b/i]
];

const DEVELOPMENT_SERVER_PATTERN = /\b(vite|next\s+dev|nuxt\s+dev|astro\b.*\bdev|svelte-kit\s+dev|ng\s+serve|parcel\s+serve|rspack\s+dev|rsbuild\s+dev|remix\s+dev|gatsby\s+develop|docusaurus\s+start|storybook\s+dev|vuepress\s+dev|quasar\s+dev|manage\.py\s+runserver|django-admin\s+runserver|flask\s+run|uvicorn\b.*--reload|hypercorn\b.*--reload|mkdocs\s+serve|hugo\s+server|jekyll\s+serve|deno\s+(?:task\s+dev|run\s+--watch)|bun\s+(?:run\s+)?dev|bundle\s+exec\s+puma\s+--development|php\s+artisan\s+serve|symfony\s+server:start|php\s+-S|dotnet\s+watch\s+run)\b/i;

export function classifyProcess(processInfo = {}) {
  const haystack = `${processInfo.name ?? ""} ${processInfo.command ?? ""}`.toLowerCase();
  const user = String(processInfo.user ?? "").trim().toLowerCase();

  if (isPrivilegedUser(user)) {
    return {
      protected: true,
      serviceName: "高权限进程",
      reason: `进程归属高权限账户 ${processInfo.user}，LocalEnv-Guard 不提供自动终止选项。请使用 sudo 或管理员终端手动确认。`
    };
  }

  for (const [serviceName, pattern] of PROTECTED_PATTERNS) {
    if (pattern.test(haystack)) {
      return {
        protected: true,
        serviceName,
        reason: `${serviceName} 属于数据库/中间件/系统级服务，LocalEnv-Guard 不提供自动终止选项。`
      };
    }
  }

  return {
    protected: false,
    serviceName: null,
    reason: "未命中保护服务名单。"
  };
}

export function findProtectedProcess(processes = []) {
  for (const processInfo of processes) {
    const classification = classifyProcess(processInfo);
    if (classification.protected) {
      return { process: processInfo, classification };
    }
  }
  return null;
}

export function canSafelyTerminateProcess(processInfo = {}, classification = classifyProcess(processInfo)) {
  if (classification.protected) {
    return { allowed: false, reason: classification.reason };
  }

  if (DEVELOPMENT_SERVER_PATTERN.test(String(processInfo.command ?? ""))) {
    return { allowed: true, reason: "已识别为明确的本地开发服务器命令。" };
  }

  return {
    allowed: false,
    reason: "无法确认该进程是本地开发服务器，为避免误杀不提供终止选项。"
  };
}

export function getSafeCurrentOwner(originalOwner, currentOwners = []) {
  const currentOwner = currentOwners.find((owner) => owner.pid === originalOwner.pid);
  if (!currentOwner || !hasSameProcessIdentity(originalOwner, currentOwner)) {
    return null;
  }
  const classification = classifyProcess(currentOwner);
  return canSafelyTerminateProcess(currentOwner, classification).allowed ? currentOwner : null;
}

function hasSameProcessIdentity(originalOwner, currentOwner) {
  if (!originalOwner.command || originalOwner.command !== currentOwner.command) {
    return false;
  }
  if (originalOwner.startedAt || currentOwner.startedAt) {
    return originalOwner.startedAt === currentOwner.startedAt;
  }
  return true;
}

function isPrivilegedUser(user) {
  return ["root", "system", "nt authority\\system", "s-1-5-18", "local service", "network service"].includes(user);
}
