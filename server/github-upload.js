import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function uploadToGitHub() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Repository details
    const repoName = 'poslavadero offline';
    const description = 'Sistema POS offline para lavadero de autos - Paraguay (Desktop SQLite version)';
    
    console.log('Checking if GitHub repository exists...');
    
    let repo;
    try {
      // Try to get existing repository
      const { data: existingRepo } = await octokit.rest.repos.get({
        owner: (await octokit.rest.users.getAuthenticated()).data.login,
        repo: repoName,
      });
      
      console.log(`Repository already exists: ${existingRepo.html_url}`);
      console.log('Updating existing repository...');
      repo = existingRepo;
      
    } catch (error) {
      if (error.status === 404) {
        // Repository doesn't exist, create it
        console.log('Creating new GitHub repository...');
        const { data: newRepo } = await octokit.rest.repos.createForAuthenticatedUser({
          name: repoName,
          description: description,
          private: false,
          auto_init: false,
        });
        
        console.log(`Repository created: ${newRepo.html_url}`);
        repo = newRepo;
      } else {
        throw error;
      }
    }
    
    // Get all files to upload (excluding ignored files)
    const filesToUpload = [
      // Main files
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'vite.config.ts',
      'tailwind.config.ts',
      'postcss.config.js',
      'components.json',
      'drizzle.config.ts',
      'electron-builder.json',
      'electron-builder.config.js',
      '.gitignore',
      
      // Documentation
      'README-DISTRIBUCION.md',
      'DEPLOYMENT-GUIDE.md',
      'LICENSE.txt',
      'design_guidelines.md',
      'replit.md',
      
      // Client files
      'client/index.html',
      'client/src/main.tsx',
      'client/src/App.tsx',
      'client/src/index.css',
      
      // Server files
      'server/index.ts',
      'server/routes.ts',
      'server/storage.ts',
      'server/vite.ts',
      'server/utils/paraguayan-validators.ts',
      
      // Shared files
      'shared/schema.ts',
      
      // Electron files
      'electron/main.ts',
      'electron/main.js',
      
      // Assets
      'assets/icon.png',
      'assets/icon.ico',
      'assets/icon-requirements.md',
    ];
    
    // Add all component files
    const componentFiles = await getAllFiles('client/src/components');
    const pageFiles = await getAllFiles('client/src/pages');
    const hookFiles = await getAllFiles('client/src/hooks');
    const libFiles = await getAllFiles('client/src/lib');
    
    const allFiles = [...filesToUpload, ...componentFiles, ...pageFiles, ...hookFiles, ...libFiles];
    
    console.log(`Uploading ${allFiles.length} files...`);
    
    // Create files in the repository
    for (const filePath of allFiles) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        const encodedContent = Buffer.from(content).toString('base64');
        
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: repo.owner.login,
          repo: repo.name,
          path: filePath,
          message: `Add ${filePath}`,
          content: encodedContent,
        });
        
        console.log(`✓ Uploaded: ${filePath}`);
      } catch (error) {
        console.warn(`⚠ Could not upload ${filePath}:`, error.message);
      }
    }
    
    console.log('\n🎉 Repository created successfully!');
    console.log(`📍 URL: ${repo.html_url}`);
    console.log(`📦 Clone: git clone ${repo.clone_url}`);
    
    return repo.html_url;
    
  } catch (error) {
    console.error('Error uploading to GitHub:', error);
    throw error;
  }
}

async function getAllFiles(dir) {
  const files = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (item.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't read it
    console.warn(`Could not read directory ${dir}:`, error.message);
  }
  
  return files;
}

// Run the upload
uploadToGitHub()
  .then((url) => {
    console.log('\n✅ SUCCESS! Your 1SOLUTION repository is now available on GitHub:');
    console.log(url);
  })
  .catch((error) => {
    console.error('\n❌ FAILED to upload to GitHub:', error.message);
    process.exit(1);
  });