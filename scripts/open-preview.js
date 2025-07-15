#!/usr/bin/env node

/**
 * Open Preview Script
 * 
 * Opens the latest Vercel preview deployment in your default browser.
 * Reads the preview URL from GitHub Actions artifacts or Vercel CLI.
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function getPreviewUrlFromGitHub() {
  try {
    // Check if we have GitHub CLI installed
    const ghInstalled = await new Promise((resolve) => {
      exec('gh --version', (error) => resolve(!error));
    });

    if (!ghInstalled) {
      log('GitHub CLI not installed. Install with: brew install gh', colors.yellow);
      return null;
    }

    log('Fetching latest preview URL from GitHub...', colors.cyan);

    // Get the latest workflow run
    const workflowRuns = await execCommand(
      'gh run list --workflow=vercel-preview.yml --limit=1 --json databaseId,status'
    );
    
    const runs = JSON.parse(workflowRuns);
    if (!runs || runs.length === 0) {
      log('No preview deployments found', colors.yellow);
      return null;
    }

    const latestRun = runs[0];
    if (latestRun.status !== 'completed') {
      log(`Latest deployment is ${latestRun.status}. Please wait...`, colors.yellow);
      return null;
    }

    // Download artifacts
    const artifactPath = path.join(process.cwd(), '.preview-artifacts');
    await fs.mkdir(artifactPath, { recursive: true });

    await execCommand(
      `gh run download ${latestRun.databaseId} -n preview-url -D ${artifactPath}`
    );

    // Read the preview URL
    const urlPath = path.join(artifactPath, 'preview-url.txt');
    const previewUrl = await fs.readFile(urlPath, 'utf8');

    // Clean up
    await fs.rm(artifactPath, { recursive: true, force: true });

    return previewUrl.trim();
  } catch (error) {
    log(`GitHub artifact fetch failed: ${error.message}`, colors.yellow);
    return null;
  }
}

async function getPreviewUrlFromVercel() {
  try {
    log('Checking Vercel deployments...', colors.cyan);
    
    const deployments = await execCommand('vercel ls --json');
    const data = JSON.parse(deployments);
    
    if (!data.deployments || data.deployments.length === 0) {
      log('No Vercel deployments found', colors.yellow);
      return null;
    }

    // Find the latest preview deployment
    const preview = data.deployments.find(d => 
      d.meta && d.meta.githubCommitRef && d.meta.githubCommitRef !== 'main'
    );

    if (preview) {
      return `https://${preview.url}`;
    }

    // Fallback to latest deployment
    return `https://${data.deployments[0].url}`;
  } catch (error) {
    log(`Vercel CLI not installed or not logged in`, colors.yellow);
    log(`Install with: npm i -g vercel`, colors.yellow);
    log(`Login with: vercel login`, colors.yellow);
    return null;
  }
}

async function getPreviewUrlFromLocal() {
  try {
    // Check for local .vercel directory
    const vercelConfig = path.join(process.cwd(), '.vercel', 'project.json');
    const configData = await fs.readFile(vercelConfig, 'utf8');
    const config = JSON.parse(configData);
    
    if (config.projectId && config.orgId) {
      // Construct preview URL pattern
      const projectName = path.basename(process.cwd());
      return `https://${projectName}-git-*-${config.orgId}.vercel.app`;
    }
  } catch (error) {
    // No local config
  }
  return null;
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function openUrl(url) {
  const platform = process.platform;
  let command;

  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      log(`Failed to open browser: ${error.message}`, colors.red);
      log(`Please manually open: ${url}`, colors.yellow);
    } else {
      log('✨ Preview opened in browser!', colors.green);
    }
  });
}

async function main() {
  console.clear();
  log('🚀 CourseAI Preview Opener', colors.bright + colors.blue);
  log('=' .repeat(40), colors.blue);

  // Try different methods to get preview URL
  let previewUrl = await getPreviewUrlFromGitHub();
  
  if (!previewUrl) {
    previewUrl = await getPreviewUrlFromVercel();
  }

  if (!previewUrl) {
    previewUrl = await getPreviewUrlFromLocal();
    if (previewUrl) {
      log(`\n⚠️  Using pattern: ${previewUrl}`, colors.yellow);
      log('For exact URL, deploy first or check GitHub', colors.yellow);
      return;
    }
  }

  if (!previewUrl) {
    log('\n❌ No preview URL found!', colors.red);
    log('\nTo create a preview:', colors.yellow);
    log('1. Push your changes to a branch', colors.reset);
    log('2. Create a pull request', colors.reset);
    log('3. Wait for deployment to complete', colors.reset);
    log('4. Run this script again', colors.reset);
    return;
  }

  log(`\n🔗 Preview URL: ${colors.bright}${previewUrl}`, colors.green);
  log('\nOpening in browser...', colors.cyan);
  
  openUrl(previewUrl);

  // Show quick testing guide
  log('\n' + '='.repeat(40), colors.blue);
  log('📋 Quick Testing Guide:', colors.bright + colors.yellow);
  log('1. Click "Reset & Seed Demo" button', colors.reset);
  log('2. Login with:', colors.reset);
  log('   • demo@example.com / demo123', colors.cyan);
  log('   • test@example.com / test123', colors.cyan);  
  log('3. Test AI coaching features', colors.reset);
  log('4. Check workout progression (10% rule)', colors.reset);
  log('=' .repeat(40), colors.blue);
}

// Run the script
main().catch(error => {
  log(`\n❌ Error: ${error.message}`, colors.red);
  process.exit(1);
});