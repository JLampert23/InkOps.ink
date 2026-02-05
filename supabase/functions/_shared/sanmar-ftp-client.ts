/**
 * SanMar SFTP Client
 *
 * Connects to SanMar's SFTP server and downloads product data files
 * Host: ftp.sanmar.com:2200
 * Protocol: SFTP
 */

export interface SanMarFTPCredentials {
  username: string;
  password: string;
}

export interface FileDownloadResult {
  filename: string;
  content: string;
  size: number;
  success: boolean;
  error?: string;
}

const SANMAR_SFTP_HOST = "ftp.sanmar.com";
const SANMAR_SFTP_PORT = 2200;
const SANMAR_FTP_PATH = "/SanMarPDD/";

const REQUIRED_FILES = [
  "SanMar_SDL_N.csv",
  "SanMar_EPDD.csv",
  "sanmar_pdd.txt",
  "sanmar_dip.txt",
  "Catalog.txt",
];

const OPTIONAL_FILES = [
  "sanmar_dp.csv",
  "sanmar_dpc.csv",
  "sanmar_activeproductsexport.txt",
];

/**
 * Downloads files from SanMar SFTP server
 *
 * Note: Deno's native SFTP support is limited. This implementation uses
 * a workaround by shelling out to curl with SFTP protocol support.
 */
export async function downloadSanMarFiles(
  credentials: SanMarFTPCredentials
): Promise<FileDownloadResult[]> {
  const results: FileDownloadResult[] = [];
  const allFiles = [...REQUIRED_FILES, ...OPTIONAL_FILES];

  console.log(`📦 Downloading ${allFiles.length} files from SanMar SFTP...`);

  for (const filename of allFiles) {
    try {
      const url = `sftp://${SANMAR_SFTP_HOST}:${SANMAR_SFTP_PORT}${SANMAR_FTP_PATH}${filename}`;

      console.log(`⬇️ Downloading: ${filename}`);

      // Use curl with SFTP support
      const command = new Deno.Command("curl", {
        args: [
          "-s",
          "-u", `${credentials.username}:${credentials.password}`,
          url,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();

      if (code === 0) {
        const content = new TextDecoder().decode(stdout);

        if (content.length === 0) {
          console.warn(`⚠️ File ${filename} is empty`);
          results.push({
            filename,
            content: "",
            size: 0,
            success: false,
            error: "File is empty"
          });
        } else {
          console.log(`✅ Downloaded ${filename}: ${content.length} bytes`);
          results.push({
            filename,
            content,
            size: content.length,
            success: true,
          });
        }
      } else {
        const errorText = new TextDecoder().decode(stderr);
        console.error(`❌ Failed to download ${filename}:`, errorText);

        results.push({
          filename,
          content: "",
          size: 0,
          success: false,
          error: errorText || "Download failed"
        });
      }
    } catch (error: any) {
      console.error(`❌ Exception downloading ${filename}:`, error);
      results.push({
        filename,
        content: "",
        size: 0,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`📊 Download complete: ${successCount}/${allFiles.length} files successful`);

  return results;
}

/**
 * Alternative implementation using fetch (if SanMar supports HTTPS downloads)
 */
export async function downloadSanMarFileHTTPS(
  credentials: SanMarFTPCredentials,
  filename: string
): Promise<FileDownloadResult> {
  try {
    const url = `https://ftp.sanmar.com/SanMarPDD/${filename}`;
    const basicAuth = btoa(`${credentials.username}:${credentials.password}`);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${basicAuth}`,
      },
    });

    if (!response.ok) {
      return {
        filename,
        content: "",
        size: 0,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const content = await response.text();

    return {
      filename,
      content,
      size: content.length,
      success: true,
    };
  } catch (error: any) {
    return {
      filename,
      content: "",
      size: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Validates that required files were downloaded successfully
 */
export function validateDownloadResults(results: FileDownloadResult[]): {
  valid: boolean;
  missingFiles: string[];
  errors: string[];
} {
  const successfulFiles = results.filter(r => r.success).map(r => r.filename);
  const missingRequired = REQUIRED_FILES.filter(f => !successfulFiles.includes(f));
  const errors = results.filter(r => !r.success && r.error).map(r => `${r.filename}: ${r.error}`);

  return {
    valid: missingRequired.length === 0,
    missingFiles: missingRequired,
    errors,
  };
}
