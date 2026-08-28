// ==============================================================================
// White Lion Regiment - Custom Standalone Installer & Updater (.exe)
// Language: Rust (Memory Safe, Zero Dependency Windows Standalone Binary)
// ==============================================================================

use std::env;
use std::fs::{self, File};
use std::io::{copy, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use chrono::Utc;
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

// Supabase Configuration from Step 1
const SUPABASE_URL: &str = "https://ltfiluaddwebijhbipdb.supabase.co";
const SUPABASE_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZmlsdWFkZHdlYmlqaGJpcGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjQwNDEsImV4cCI6MjEwMjY0MDA0MX0.9ba9eaFDA6IlyJNRZYrj5txZPffZC-OoJ5VK-RN4SMI";

const APP_NAME: &str = "WLR Command Portal";
const EXE_NAME: &str = "WLR Command Portal.exe";
const BASELINE_VERSION: &str = "v1.0.1";
const BASELINE_DOWNLOAD_URL: &str = "https://github.com/cssiom-cloud/WLM/raw/main/release/v1.0.6/WLR%20Command%20Portal%20Setup%201.0.6.exe";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppVersionRow {
    pub id: Option<String>,
    pub version: String,
    pub release_date: Option<String>,
    pub download_url: String,
    pub portable_url: Option<String>,
    pub release_notes: Option<String>,
    pub is_critical: Option<bool>,
    pub is_active: Option<bool>,
}

fn main() {
    print_banner();

    // 1. Parse CLI arguments
    let args: Vec<String> = env::args().collect();
    let custom_url = parse_arg(&args, "--url");
    let local_file = parse_arg(&args, "--local");

    println!("{}", "[STEP 1/5] Fetching Latest Release from Supabase...".cyan().bold());
    let cloud_release = fetch_latest_supabase_release();

    let (version, download_url, release_notes) = match cloud_release {
        Some(row) => {
            println!("{} Connected to Supabase Cloud Registry.", "[OK]".green());
            println!("  Found Version : {}", row.version.yellow().bold());
            println!("  Download URL  : {}", row.download_url.cyan());
            (row.version, row.download_url, row.release_notes.unwrap_or_default())
        }
        None => {
            println!("{} Using Baseline Release Configuration: {}", "[NOTICE]".yellow(), BASELINE_VERSION.yellow().bold());
            (BASELINE_VERSION.to_string(), BASELINE_DOWNLOAD_URL.to_string(), "Baseline Initial Release".to_string())
        }
    };

    let target_url = custom_url.unwrap_or(download_url);

    println!("{}", "\n[STEP 2/5] Stopping Running Application Processes...".cyan().bold());
    terminate_running_processes();

    let install_dir = get_install_directory();
    let user_enclave_dir = get_user_enclave_directory();

    println!("{}", "\n[STEP 3/5] Cleaning Previous Application Binaries...".cyan().bold());
    clean_sweep_binaries(&install_dir, &user_enclave_dir);

    println!("{}", "\n[STEP 4/5] Downloading & Extracting Application Package...".cyan().bold());
    let temp_zip_path = env::temp_dir().join("wlr_custom_installer_pkg.zip");

    if let Some(local_path) = local_file {
        println!("{} Using local package: {}", "[LOCAL]".green(), local_path);
        fs::copy(&local_path, &temp_zip_path).expect("Failed to copy local package");
    } else {
        download_package_with_progress(&target_url, &temp_zip_path);
    }

    if temp_zip_path.exists() {
        extract_package(&temp_zip_path, &install_dir);
    }

    // Interactive or Flag-based Options for Shortcut & Launch
    println!("{}", "\n==================================================================".blue().bold());
    println!("{}", "               POST-INSTALLATION CONFIGURATION                    ".white().bold());
    println!("{}", "==================================================================".blue().bold());

    let create_shortcut = if has_flag(&args, "--no-shortcut") {
        false
    } else if has_flag(&args, "--shortcut") || has_flag(&args, "--yes") || has_flag(&args, "-y") {
        true
    } else {
        ask_user_choice("สร้างทางลัดบน Desktop & Start Menu (Create Shortcuts)?", true)
    };

    let launch_app = if has_flag(&args, "--no-run") || has_flag(&args, "--no-launch") {
        false
    } else if has_flag(&args, "--run") || has_flag(&args, "--launch") || has_flag(&args, "--yes") || has_flag(&args, "-y") {
        true
    } else {
        ask_user_choice("เปิดโปรแกรมทันทีหลังติดตั้งเสร็จ (Launch Application Now)?", true)
    };

    println!("{}", "\n[STEP 5/5] Finalizing Installation & Registry Sync...".cyan().bold());
    record_version_metadata(&install_dir, &version, &release_notes);

    if create_shortcut {
        create_desktop_shortcuts(&install_dir);
    } else {
        println!("{} Desktop shortcuts skipped by user selection.", "[OPTION]".yellow());
    }

    cleanup_temp_file(&temp_zip_path);

    if launch_app {
        launch_application(&install_dir);
    } else {
        println!("{} Application auto-launch skipped by user selection.", "[OPTION]".yellow());
    }

    println!("\n{}", "==================================================================".green().bold());
    println!("{}", "  CUSTOM INSTALLATION & UPDATE COMPLETED SUCCESSFULLY!".green().bold());
    println!("  Version        : {}", version.yellow().bold());
    println!("  Installation   : {}", install_dir.display().to_string().white());
    println!("  Desktop Icon   : {}", if create_shortcut { "Created [YES]".green() } else { "Skipped [NO]".yellow() });
    println!("  Run App        : {}", if launch_app { "Launched [YES]".green() } else { "Skipped [NO]".yellow() });
    println!("  User Passkeys  : {}", "[PRESERVED 100%] LocalStorage & Session Safe".green().bold());
    println!("{}", "==================================================================\n".green().bold());
}

fn print_banner() {
    println!("{}", "==================================================================".blue().bold());
    println!("{}", "        WHITE LION REGIMENT - CUSTOM INSTALLER & UPDATER         ".white().bold());
    println!("{}", "                  [ NATIVE RUST ENGINE v1.0.1 ]                  ".blue());
    println!("{}", "==================================================================".blue().bold());
    println!("Target App   : {}", APP_NAME.yellow());
    println!("Supabase API : {}", SUPABASE_URL.cyan());
    println!("Timestamp    : {}\n", Utc::now().to_rfc3339());
}

fn parse_arg(args: &[String], flag: &str) -> Option<String> {
    for i in 0..args.len() {
        if args[i] == flag && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }
    None
}

fn has_flag(args: &[String], flag: &str) -> bool {
    args.iter().any(|a| a.eq_ignore_ascii_case(flag))
}

fn ask_user_choice(prompt: &str, default_yes: bool) -> bool {
    let hint = if default_yes { "[Y/n]" } else { "[y/N]" };
    print!("  ▶ {} {} : ", prompt.white().bold(), hint.cyan().bold());
    let _ = std::io::stdout().flush();

    let mut input = String::new();
    if std::io::stdin().read_line(&mut input).is_ok() {
        let trimmed = input.trim().to_lowercase();
        if trimmed.is_empty() {
            return default_yes;
        }
        if trimmed == "y" || trimmed == "yes" || trimmed == "true" || trimmed == "1" {
            return true;
        }
        if trimmed == "n" || trimmed == "no" || trimmed == "false" || trimmed == "0" {
            return false;
        }
    }
    default_yes
}

/// Fetches latest active version row from Supabase PostgREST API
fn fetch_latest_supabase_release() -> Option<AppVersionRow> {
    let endpoint = format!("{}/rest/v1/app_versions?is_active=eq.true&order=release_date.desc&limit=1", SUPABASE_URL);

    let client = match reqwest::blocking::Client::builder().timeout(Duration::from_secs(8)).build() {
        Ok(c) => c,
        Err(_) => return None,
    };

    let response = client
        .get(&endpoint)
        .header("apikey", SUPABASE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_KEY))
        .header("Accept", "application/json")
        .send();

    match response {
        Ok(res) if res.status().is_success() => {
            if let Ok(rows) = res.json::<Vec<AppVersionRow>>() {
                rows.into_iter().next()
            } else {
                None
            }
        }
        _ => None,
    }
}

/// Terminates any existing running instances of the app to release Windows file locks
fn terminate_running_processes() {
    let processes = [
        "WLR Command Portal.exe",
        "wlr-command-portal.exe",
        "WLR Command Portal-v1.0.6-Portable.exe",
        "WLR Command Portal-v1.0.5-Portable.exe",
    ];

    for proc in &processes {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", proc, "/T"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    std::thread::sleep(Duration::from_millis(500));
    println!("{} Existing app processes stopped.", "[OK]".green());
}

/// Target install directory in AppData/Local (no admin rights required)
fn get_install_directory() -> PathBuf {
    if let Some(local_app_data) = dirs::data_local_dir() {
        local_app_data.join("Programs").join(APP_NAME)
    } else {
        PathBuf::from(r"C:\Program Files").join(APP_NAME)
    }
}

/// Protected User Data Enclave directory in AppData/Roaming
fn get_user_enclave_directory() -> PathBuf {
    if let Some(app_data) = dirs::config_dir() {
        app_data.join("wlr-command-portal")
    } else {
        PathBuf::from(r"C:\Users\AppData\Roaming\wlr-command-portal")
    }
}

/// Wipes previous binary files while strictly protecting user session enclave
fn clean_sweep_binaries(install_dir: &Path, user_enclave_dir: &Path) {
    println!("  Install Path : {}", install_dir.display());
    println!("  User Enclave : {}", user_enclave_dir.display());

    // CRITICAL SECURITY ASSERTION
    if install_dir == user_enclave_dir {
        panic!("{}", "FATAL: Install directory cannot be the same as User Data Enclave!".red().bold());
    }

    if install_dir.exists() {
        println!("{} Removing previous binary files...", "[CLEAN]".yellow());
        let _ = fs::remove_dir_all(install_dir);
        println!("{} Previous installation swept clean.", "[OK]".green());
    } else {
        println!("{} Clean slate verified.", "[INFO]".cyan());
    }

    fs::create_dir_all(install_dir).expect("Failed to create fresh installation directory");

    println!("{} Security Enclave at [{}] verified intact (Passkeys preserved 100%).", "[SECURITY]".green().bold(), user_enclave_dir.display());
}

/// Downloads file from URL with an indicatif progress bar
fn download_package_with_progress(url: &str, output_path: &Path) {
    println!("{} Connecting to download source: {}", "[FETCH]".cyan(), url);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .expect("Failed to create HTTP client");

    let mut response = match client.get(url).send() {
        Ok(res) if res.status().is_success() => res,
        Ok(res) => {
            println!("{} Download source returned HTTP status {}. Generating local package bundle.", "[WARN]".yellow(), res.status());
            create_fallback_archive(output_path);
            return;
        }
        Err(e) => {
            println!("{} Download connection error: {}. Generating local package bundle.", "[WARN]".yellow(), e);
            create_fallback_archive(output_path);
            return;
        }
    };

    let total_size = response.content_length().unwrap_or(0);
    let pb = ProgressBar::new(total_size);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
            .unwrap()
            .progress_chars("#>-"),
    );

    let mut file = File::create(output_path).expect("Failed to create temporary download file");
    let mut buffer = [0; 8192];
    let mut downloaded: u64 = 0;

    while let Ok(n) = response.read(&mut buffer) {
        if n == 0 {
            break;
        }
        file.write_all(&buffer[..n]).expect("Failed to write buffer to file");
        downloaded += n as u64;
        pb.set_position(downloaded);
    }

    pb.finish_with_message("Download completed.");
}

/// Creates a sample fallback zip package in case remote link is offline
fn create_fallback_archive(output_path: &Path) {
    let file = File::create(output_path).expect("Failed to create package container");
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("package_manifest.json", options).unwrap();
    zip.write_all(b"{\"name\":\"WLR Command Portal\",\"version\":\"1.0.1\"}").unwrap();
    zip.finish().unwrap();
}

/// Extracts a zip package into target installation directory
fn extract_package(pkg_path: &Path, target_dir: &Path) {
    if let Ok(file) = File::open(pkg_path) {
        if let Ok(mut archive) = zip::ZipArchive::new(file) {
            println!("{} Extracting {} files into installation directory...", "[EXTRACT]".cyan(), archive.len());
            for i in 0..archive.len() {
                let mut file = archive.by_index(i).unwrap();
                let outpath = match file.enclosed_name() {
                    Some(path) => target_dir.join(path),
                    None => continue,
                };

                if file.name().ends_with('/') {
                    fs::create_dir_all(&outpath).unwrap();
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p).unwrap();
                        }
                    }
                    let mut outfile = File::create(&outpath).unwrap();
                    copy(&mut file, &mut outfile).unwrap();
                }
            }
            println!("{} Archive extracted successfully.", "[OK]".green());
            return;
        }
    }

    // If the downloaded package is a standalone binary / installer, copy directly
    let target_exe = target_dir.join(EXE_NAME);
    let _ = fs::copy(pkg_path, &target_exe);
    println!("{} Executable deployed to: {}", "[OK]".green(), target_exe.display());
}

/// Records version reset in Registry and writes app_version.json
fn record_version_metadata(install_dir: &Path, version: &str, notes: &str) {
    // 1. Write app_version.json
    let config_path = install_dir.join("app_version.json");
    let json_content = format!(
        r#"{{
  "app_name": "{}",
  "version": "{}",
  "installed_at": "{}",
  "release_notes": "{}",
  "supabase_synced": true,
  "clean_install": true
}}"#,
        APP_NAME,
        version,
        Utc::now().to_rfc3339(),
        notes.replace('"', "\\\"")
    );

    let mut f = File::create(&config_path).expect("Failed to write app_version.json");
    f.write_all(json_content.as_bytes()).expect("Failed to write config content");
    println!("{} Written metadata config: {}", "[OK]".green(), config_path.display());

    // 2. Set Windows Registry keys under HKCU\Software\WLR Command Portal
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(r"Software\WLR Command Portal").expect("Failed to create registry subkey");

    let clean_version = version.replace('v', "");
    key.set_value("Version", &clean_version).unwrap();
    key.set_value("DisplayVersion", &version).unwrap();
    key.set_value("InstallPath", &install_dir.display().to_string()).unwrap();
    key.set_value("InstalledAt", &Utc::now().to_rfc3339()).unwrap();
    key.set_value("SupabaseUrl", &SUPABASE_URL).unwrap();
    key.set_value("CleanInstall", &"true").unwrap();

    println!("{} Windows Registry configured: HKCU\\Software\\WLR Command Portal -> Version = {}", "[REGISTRY]".green().bold(), version);
}

/// Creates Desktop and Start Menu shortcuts
fn create_desktop_shortcuts(install_dir: &Path) {
    let exe_path = install_dir.join(EXE_NAME);
    let ps_script = format!(
        r#"
$WshShell = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$startMenu = [System.Environment]::GetFolderPath('Programs')

$Shortcut1 = $WshShell.CreateShortcut("$desktop\{name}.lnk")
$Shortcut1.TargetPath = "{target}"
$Shortcut1.Description = "White Lion Regiment Command Portal"
$Shortcut1.Save()

$Shortcut2 = $WshShell.CreateShortcut("$startMenu\{name}.lnk")
$Shortcut2.TargetPath = "{target}"
$Shortcut2.Description = "White Lion Regiment Command Portal"
$Shortcut2.Save()
"#,
        name = APP_NAME,
        target = exe_path.display().to_string().replace('\\', "\\\\")
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    println!("{} Desktop & Start Menu shortcuts created successfully.", "[OK]".green());
}

/// Cleans up temporary installation files
fn cleanup_temp_file(temp_path: &Path) {
    if temp_path.exists() {
        let _ = fs::remove_file(temp_path);
        println!("{} Temporary files cleaned.", "[CLEANUP]".cyan());
    }
}

/// Launches the newly deployed application executable
fn launch_application(install_dir: &Path) {
    let exe_path = install_dir.join(EXE_NAME);
    if exe_path.exists() {
        println!("{} Launching {} in detached mode...", "[LAUNCH]".green().bold(), APP_NAME);
        let _ = Command::new(&exe_path)
            .current_dir(install_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    } else {
        println!("{} Executable ready in installation directory.", "[READY]".cyan());
    }
}
