# Payment System Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the payment backend system using the automated deployment pipeline with health checks, monitoring, and rollback capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Pipeline](#deployment-pipeline)
- [Health Checks](#health-checks)
- [Monitoring](#monitoring)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Prerequisites

### Required Tools
- **Docker**: Container runtime and image building
- **Kubernetes**: Container orchestration (kubectl configured)
- **Node.js 18+**: For running deployment scripts locally
- **GitHub Actions**: CI/CD pipeline execution

### Required Access
- **Container Registry**: Push/pull access to container registry
- **Kubernetes Clusters**: Deploy access to staging and production clusters
- **GitHub Repository**: Admin access for secrets and workflow management
- **Monitoring Systems**: Access to monitoring and alerting platforms

### Required Secrets

Configure the following secrets in GitHub repository settings:

#### Container Registry
```bash
CONTAINER_REGISTRY=your-registry.com
CONTAINER_REGISTRY_USERNAME=your-username
CONTAINER_REGISTRY_PASSWORD=your-password
```

#### Kubernetes Configuration
```bash
KUBE_CONFIG_STAGING=base64-encoded-kubeconfig-for-staging
KUBE_CONFIG_PRODUCTION=base64-encoded-kubeconfig-for-production
```

#### Application Configuration
```bash
# Staging Environment
SUPABASE_STAGING_URL=https://your-staging-supabase-url
SUPABASE_STAGING_SERVICE_ROLE_KEY=your-staging-service-role-key
STAGING_URL=https://staging-api.ebeautything.com

# Production Environment
SUPABASE_PRODUCTION_URL=https://your-production-supabase-url
SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=your-production-service-role-key
PRODUCTION_URL=https://api.ebeautything.com

# Test Environment
SUPABASE_TEST_URL=https://your-test-supabase-url
SUPABASE_TEST_SERVICE_ROLE_KEY=your-test-service-role-key
```

#### Security Configuration
```bash
TOSS_PAYMENTS_SECRET_KEY=your-toss-payments-secret-key
TOSS_PAYMENTS_WEBHOOK_SECRET=your-webhook-secret
HEALTH_CHECK_TOKEN=your-health-check-token
MONITORING_TOKEN=your-monitoring-token
```

#### Notification Configuration
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook-url
ALERT_WEBHOOK_URL=https://your-alert-webhook-url
```

#### Security Scanning
```bash
SNYK_TOKEN=your-snyk-token
GITHUB_TOKEN=your-github-token
```

## Environment Setup

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ebeautything/backend.git
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run tests**:
   ```bash
   npm run test:comprehensive
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

### Container Setup

1. **Build Docker image**:
   ```bash
   docker build -t payment-backend:latest .
   ```

2. **Run container locally**:
   ```bash
   docker run -p 3000:3000 \
     -e NODE_ENV=production \
     -e SUPABASE_URL=your-url \
     -e SUPABASE_SERVICE_ROLE_KEY=your-key \
     payment-backend:latest
   ```

3. **Test health endpoint**:
   ```bash
   curl http://localhost:3000/health
   ```

## Deployment Pipeline

### Automatic Deployments

The deployment pipeline automatically triggers on:

- **Push to `develop` branch**: Deploys to staging
- **Push to `main` branch**: Deploys to production
- **Manual workflow dispatch**: Deploys to specified environment

### Pipeline Stages

#### 1. Validation and Testing
- **Linting and formatting**: Code quality checks
- **Unit tests**: Component-level testing with coverage
- **Integration tests**: End-to-end workflow testing
- **Security tests**: Vulnerability and penetration testing
- **E2E tests**: Complete user journey validation

#### 2. Security Scanning
- **Dependency scanning**: Snyk vulnerability assessment
- **Code analysis**: CodeQL static analysis
- **Container scanning**: Image vulnerability assessment

#### 3. Build and Package
- **Docker image build**: Multi-stage optimized build
- **Image push**: Push to container registry
- **Manifest generation**: Kubernetes deployment manifests

#### 4. Staging Deployment
- **Pre-deployment health check**: Validate current staging environment
- **Deployment**: Rolling update deployment
- **Post-deployment health check**: Comprehensive health validation
- **Smoke tests**: Critical functionality verification

#### 5. Production Deployment (Blue-Green)
- **Pre-deployment validation**: Current production health check
- **Green deployment**: Deploy new version alongside current
- **Green validation**: Comprehensive testing of new version
- **Traffic switch**: Route traffic to new version
- **Blue cleanup**: Remove old version after validation

#### 6. Post-Deployment Monitoring
- **Extended monitoring**: 30-minute continuous monitoring
- **Performance tracking**: Response time and error rate monitoring
- **Alert generation**: Automated issue detection and notification

### Manual Deployment

For emergency deployments or specific environments:

```bash
# Deploy to staging
gh workflow run deployment-pipeline.yml \
  -f environment=staging \
  -f skip_tests=false

# Emergency production deployment (skip tests)
gh workflow run deployment-pipeline.yml \
  -f environment=production \
  -f skip_tests=true
```

## Health Checks

### Health Check Endpoints

The application provides multiple health check endpoints:

- **`/health`**: Basic health status
- **`/health/ready`**: Readiness check for load balancers
- **`/health/detailed`**: Comprehensive component health

### Health Check Components

#### Database Health
- **Connection status**: Supabase connectivity
- **Query performance**: Response time validation
- **Connection pool**: Available connections

#### External Services
- **TossPayments API**: Payment service connectivity
- **FCM**: Push notification service
- **Third-party APIs**: External service dependencies

#### System Resources
- **Memory usage**: Available memory and usage patterns
- **CPU usage**: Current CPU utilization
- **Disk space**: Available storage

### Health Check Scripts

#### Pre-deployment Health Check
```bash
node scripts/deployment-health-check.js \
  --environment=production \
  --pre-deployment \
  --timeout=300
```

#### Post-deployment Health Check
```bash
node scripts/deployment-health-check.js \
  --environment=production \
  --timeout=300
```

#### Traffic Verification
```bash
node scripts/deployment-health-check.js \
  --environment=production \
  --verify-traffic
```

## Monitoring

### Continuous Monitoring

The deployment pipeline includes comprehensive monitoring:

#### Real-time Metrics
- **Response time**: API endpoint performance
- **Error rate**: Request failure percentage
- **Availability**: Service uptime percentage
- **Throughput**: Requests per second

#### Alert Thresholds
- **Response time**: > 3 seconds
- **Error rate**: > 10%
- **Availability**: < 95%
- **Consecutive failures**: > 3

#### Monitoring Scripts

**Start monitoring**:
```bash
node scripts/deployment-monitor.js \
  --environment=production \
  --duration=1800 \
  --extended=true
```

**Generate monitoring report**:
```bash
node scripts/generate-deployment-report.js \
  --deployment-id=$GITHUB_SHA
```

### Monitoring Dashboard

Access monitoring data through:
- **Application logs**: Container and application logs
- **Health check results**: Endpoint status and performance
- **System metrics**: Resource utilization
- **Business metrics**: Payment processing statistics

## Rollback Procedures

### Automatic Rollback

The pipeline includes automatic rollback triggers:

#### Rollback Conditions
- **High error rate**: > 25% error rate
- **Consecutive failures**: > 5 consecutive health check failures
- **Critical alerts**: Security or performance critical issues

#### Rollback Process
1. **Immediate traffic routing**: Switch traffic back to previous version
2. **Health validation**: Verify rollback success
3. **Cleanup**: Remove failed deployment
4. **Notification**: Alert team of rollback

### Manual Rollback

#### Kubernetes Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/payment-backend

# Rollback to specific revision
kubectl rollout undo deployment/payment-backend --to-revision=2

# Check rollback status
kubectl rollout status deployment/payment-backend
```

#### Verify Rollback
```bash
node scripts/deployment-health-check.js \
  --environment=production \
  --verify-rollback
```

### Rollback Verification

After rollback, verify:
- **Health checks pass**: All endpoints healthy
- **Traffic routing**: Requests reaching correct version
- **Performance**: Response times within normal range
- **Functionality**: Critical features working

## Troubleshooting

### Common Issues

#### 1. Health Check Failures
**Symptoms**: Health checks failing during deployment

**Diagnosis**:
```bash
# Check application logs
kubectl logs deployment/payment-backend

# Check health endpoint directly
curl -v https://api.ebeautything.com/health

# Run detailed health check
node scripts/deployment-health-check.js --environment=production
```

**Solutions**:
- Verify environment variables are set correctly
- Check database connectivity
- Validate external service dependencies
- Review application startup logs

#### 2. Database Connection Issues
**Symptoms**: Database-related health check failures

**Diagnosis**:
```bash
# Test database connection
node -e "
const { getSupabaseClient } = require('./dist/config/database');
const client = getSupabaseClient();
client.from('users').select('count').then(console.log);
"
```

**Solutions**:
- Verify Supabase URL and service role key
- Check network connectivity
- Validate database permissions
- Review connection pool settings

#### 3. Container Registry Issues
**Symptoms**: Image pull failures during deployment

**Diagnosis**:
```bash
# Test image pull
docker pull your-registry.com/payment-backend:latest

# Check registry credentials
kubectl get secret regcred -o yaml
```

**Solutions**:
- Verify registry credentials
- Check image tag exists
- Validate network access to registry
- Review image pull policy

#### 4. Performance Issues
**Symptoms**: High response times or timeout errors

**Diagnosis**:
```bash
# Run performance monitoring
node scripts/deployment-monitor.js \
  --environment=production \
  --duration=300

# Check resource usage
kubectl top pods
kubectl describe pod payment-backend-xxx
```

**Solutions**:
- Scale up replicas if needed
- Review resource limits and requests
- Check for memory leaks
- Optimize database queries

### Emergency Procedures

#### Emergency Rollback
```bash
# Immediate rollback
kubectl rollout undo deployment/payment-backend

# Verify rollback
kubectl rollout status deployment/payment-backend

# Check health
curl https://api.ebeautything.com/health
```

#### Emergency Scaling
```bash
# Scale up replicas
kubectl scale deployment payment-backend --replicas=5

# Check scaling status
kubectl get pods -l app=payment-backend
```

#### Emergency Maintenance Mode
```bash
# Enable maintenance mode (if implemented)
kubectl patch configmap payment-backend-config \
  -p '{"data":{"MAINTENANCE_MODE":"true"}}'

# Restart pods to pick up config
kubectl rollout restart deployment/payment-backend
```

## Best Practices

### Deployment Best Practices

#### 1. Testing Strategy
- **Run full test suite**: Never skip tests in production deployments
- **Use staging environment**: Always test in staging first
- **Validate security**: Run security tests before production
- **Monitor after deployment**: Watch metrics for at least 30 minutes

#### 2. Rollback Strategy
- **Keep previous version**: Always maintain ability to rollback
- **Test rollback procedure**: Regularly test rollback in staging
- **Document rollback steps**: Clear procedures for emergency rollback
- **Monitor after rollback**: Verify system stability after rollback

#### 3. Communication
- **Notify team**: Inform team of deployments
- **Document changes**: Maintain deployment changelog
- **Share metrics**: Provide deployment success metrics
- **Post-mortem**: Review failed deployments

#### 4. Security
- **Rotate secrets**: Regularly update API keys and tokens
- **Scan images**: Always scan container images for vulnerabilities
- **Monitor access**: Track who performs deployments
- **Audit logs**: Maintain deployment audit trail

### Monitoring Best Practices

#### 1. Metrics Collection
- **Business metrics**: Track payment processing success rates
- **Technical metrics**: Monitor response times and error rates
- **Security metrics**: Track authentication failures and suspicious activity
- **Resource metrics**: Monitor CPU, memory, and disk usage

#### 2. Alerting Strategy
- **Actionable alerts**: Only alert on issues requiring immediate action
- **Alert fatigue**: Avoid too many low-priority alerts
- **Escalation**: Define clear escalation procedures
- **Documentation**: Document alert response procedures

#### 3. Dashboard Design
- **Key metrics**: Display most important metrics prominently
- **Historical data**: Show trends over time
- **Drill-down**: Allow detailed investigation of issues
- **Mobile-friendly**: Ensure dashboards work on mobile devices

### Performance Optimization

#### 1. Container Optimization
- **Multi-stage builds**: Use multi-stage Dockerfile for smaller images
- **Resource limits**: Set appropriate CPU and memory limits
- **Health checks**: Configure proper health check intervals
- **Graceful shutdown**: Handle SIGTERM signals properly

#### 2. Application Optimization
- **Connection pooling**: Use database connection pooling
- **Caching**: Implement appropriate caching strategies
- **Async operations**: Use asynchronous processing where possible
- **Error handling**: Implement proper error handling and recovery

#### 3. Infrastructure Optimization
- **Auto-scaling**: Configure horizontal pod autoscaling
- **Load balancing**: Use proper load balancing strategies
- **CDN**: Use CDN for static assets
- **Database optimization**: Optimize database queries and indexes

## Support and Maintenance

### Regular Maintenance Tasks

#### Weekly
- Review deployment metrics and success rates
- Check for security updates and patches
- Validate backup and recovery procedures
- Review monitoring alerts and false positives

#### Monthly
- Update dependencies and security patches
- Review and update deployment documentation
- Test disaster recovery procedures
- Analyze performance trends and optimization opportunities

#### Quarterly
- Security audit and penetration testing
- Capacity planning and scaling review
- Disaster recovery testing
- Team training on deployment procedures

### Getting Help

For deployment issues or questions:

- **Technical Issues**: Create GitHub issue with deployment logs
- **Security Concerns**: Contact security team immediately
- **Emergency Support**: Use emergency contact procedures
- **Documentation**: Refer to this guide and inline documentation

### Contributing

To improve the deployment pipeline:

1. **Test changes**: Always test in staging environment
2. **Document updates**: Update this guide with any changes
3. **Review process**: Get peer review for pipeline changes
4. **Rollback plan**: Ensure changes can be rolled back if needed

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Maintainer**: eBeautything DevOps Team

