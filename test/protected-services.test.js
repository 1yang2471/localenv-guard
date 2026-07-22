import assert from "node:assert/strict";
import test from "node:test";

import { canSafelyTerminateProcess, classifyProcess, findProtectedProcess } from "../src/protected-services.js";

test("数据库进程被识别为保护服务", () => {
  const result = classifyProcess({ name: "postgres", command: "/usr/lib/postgresql/bin/postgres" });

  assert.equal(result.protected, true);
  assert.match(result.reason, /PostgreSQL/);
});

test("Docker 守护进程被识别为保护服务", () => {
  const result = classifyProcess({ name: "dockerd", command: "dockerd --host fd://" });

  assert.equal(result.protected, true);
});

test("普通开发服务器不是保护服务", () => {
  const result = classifyProcess({ name: "node", command: "vite --host 0.0.0.0 --port 5173" });

  assert.equal(result.protected, false);
});

test("root 归属的进程只允许手动处理", () => {
  const result = classifyProcess({ name: "node", command: "vite --port 5173", user: "root" });

  assert.equal(result.protected, true);
  assert.match(result.reason, /root/);
});

test("Windows 核心服务宿主只允许手动处理", () => {
  const result = classifyProcess({ name: "svchost.exe", command: "C:\\Windows\\System32\\svchost.exe -k LocalService" });

  assert.equal(result.protected, true);
  assert.match(result.reason, /Windows 系统服务/);
});

test("端口的任一占用者受保护时整体熔断", () => {
  const result = findProtectedProcess([
    { pid: 100, name: "node", command: "vite --port 5173" },
    { pid: 101, name: "redis-server", command: "redis-server *:5173" }
  ]);

  assert.equal(result.process.pid, 101);
  assert.equal(result.classification.protected, true);
});

test("只有明确的开发运行时才允许提供终止选项", () => {
  const nodeResult = canSafelyTerminateProcess({ name: "node.exe", command: "vite --port 5173" });
  const unknownResult = canSafelyTerminateProcess({ name: "internal-service.exe", command: "internal-service --listen 5173" });

  assert.equal(nodeResult.allowed, true);
  assert.equal(unknownResult.allowed, false);
  assert.match(unknownResult.reason, /无法确认/);
});

test("Astro 与 Nuxt 开发命令可安全进入终止流程", () => {
  const astro = canSafelyTerminateProcess({ name: "node", command: "node node_modules/astro/astro.js dev --port 3000" });
  const nuxt = canSafelyTerminateProcess({ name: "node", command: "nuxt dev --port 3000" });

  assert.equal(astro.allowed, true);
  assert.equal(nuxt.allowed, true);
});

test("常见核心服务一律熔断", () => {
  const services = [
    ["MariaDB", "mariadbd --port 3306"],
    ["Microsoft SQL Server", "sqlservr -s MSSQLSERVER"],
    ["Oracle", "tnslsnr LISTENER"],
    ["CockroachDB", "cockroach start-single-node"],
    ["Cassandra", "cassandra -f"],
    ["Memcached", "memcached -p 11211"],
    ["CouchDB", "couchdb"],
    ["Neo4j", "neo4j console"],
    ["InfluxDB", "influxd"],
    ["ClickHouse", "clickhouse-server"],
    ["Firebird", "fbserver"],
    ["OpenSearch", "opensearch"],
    ["Solr", "solr start"],
    ["ActiveMQ", "activemq console"],
    ["NATS", "nats-server"],
    ["Pulsar", "pulsar broker"],
    ["Mosquitto", "mosquitto -p 1883"],
    ["etcd", "etcd"],
    ["Consul", "consul agent"],
    ["Vault", "vault server"],
    ["MinIO", "minio server data"],
    ["containerd", "containerd"],
    ["Podman", "podman system service"],
    ["Kubernetes", "kubelet"],
    ["Caddy", "caddy run"],
    ["Traefik", "traefik"],
    ["HAProxy", "haproxy -f config"],
    ["Envoy", "envoy -c config"],
    ["IIS", "w3wp.exe -ap DefaultAppPool"],
    ["Windows Defender", "MsMpEng.exe"],
    ["DBus", "dbus-daemon --system"],
    ["systemd-journald", "systemd-journald"],
    ["NetworkManager", "NetworkManager"],
    ["launchd", "launchd"],
    ["systemd", "systemd"],
    ["Docker", "dockerd"],
    ["PostgreSQL", "postgres -D data"],
    ["Redis", "redis-server"],
    ["MongoDB", "mongod"],
    ["RabbitMQ", "rabbitmq-server"],
    ["Kafka", "kafka.Kafka"],
    ["Nginx", "nginx"],
    ["SSH", "sshd"],
    ["Apache", "httpd"],
    ["MySQL", "mysqld"]
  ];

  for (const [label, command] of services) {
    assert.equal(classifyProcess({ name: command.split(/\s+/)[0], command }).protected, true, label);
  }
});

test("常见开发框架的明确开发命令可放行", () => {
  const commands = [
    "vite --port 3000",
    "next dev",
    "nuxt dev",
    "astro dev",
    "svelte-kit dev",
    "ng serve",
    "parcel serve index.html",
    "rspack dev",
    "rsbuild dev",
    "remix dev",
    "gatsby develop",
    "docusaurus start",
    "storybook dev",
    "vuepress dev docs",
    "quasar dev",
    "python manage.py runserver",
    "flask run",
    "uvicorn app:app --reload",
    "hypercorn app:app --reload",
    "streamlit run app.py",
    "gradio app.py",
    "mkdocs serve",
    "hugo server",
    "jekyll serve",
    "rails server",
    "bundle exec puma --development",
    "mix phx.server",
    "php artisan serve",
    "symfony server:start",
    "php -S localhost:8000",
    "air",
    "go run main.go",
    "cargo run",
    "dotnet watch run",
    "spring-boot:run",
    "deno task dev",
    "bun run dev"
  ];

  for (const command of commands) {
    assert.equal(canSafelyTerminateProcess({ name: "runtime", command }).allowed, true, command);
  }
});

test("受保护服务优先于开发命令证据", () => {
  const result = canSafelyTerminateProcess({
    name: "redis-server",
    command: "redis-server --dev vite --port 6379"
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /Redis/);
});
