/**
 * Advanced Import Table Analyzer
 * Deep analysis of PE import table with API categorization,
 * suspicious pattern detection, and behavioral inference
 */

import { promises as fs } from 'fs';
import { ThreatLevel } from '../../../shared/virushunt-types';

/**
 * API behavior categories
 */
export enum ApiBehavior {
  PROCESS_INJECTION = 'process_injection',
  KEYLOGGING = 'keylogging',
  SCREEN_CAPTURE = 'screen_capture',
  FILE_OPERATIONS = 'file_operations',
  REGISTRY_MODIFICATION = 'registry_modification',
  NETWORK_COMMUNICATION = 'network_communication',
  CRYPTO_OPERATIONS = 'crypto_operations',
  ANTI_DEBUG = 'anti_debug',
  ANTI_VM = 'anti_vm',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  PERSISTENCE = 'persistence',
  SERVICE_MANIPULATION = 'service_manipulation',
  HOOKING = 'hooking',
  DLL_INJECTION = 'dll_injection',
  PROCESS_HOLLOWING = 'process_hollowing',
  MEMORY_MANIPULATION = 'memory_manipulation',
  CLIPBOARD_ACCESS = 'clipboard_access',
  SYSTEM_INFORMATION = 'system_information',
  USER_IMPERSONATION = 'user_impersonation'
}

/**
 * Suspicious API definition
 */
interface SuspiciousApi {
  name: string;
  behavior: ApiBehavior;
  severity: ThreatLevel;
  description: string;
  combinations?: string[];  // More suspicious when combined with these
}

/**
 * Import analysis result
 */
export interface ImportAnalysisResult {
  totalImports: number;
  totalDlls: number;
  imports: {
    dll: string;
    functions: string[];
    isSuspicious: boolean;
  }[];
  suspiciousApis: {
    dll: string;
    function: string;
    behavior: ApiBehavior;
    severity: ThreatLevel;
    description: string;
  }[];
  detectedBehaviors: {
    behavior: ApiBehavior;
    apis: string[];
    severity: ThreatLevel;
    confidence: number;
    description: string;
  }[];
  riskScore: number;
  assessment: string;
}

/**
 * Comprehensive suspicious API database
 */
const SUSPICIOUS_APIS: Map<string, SuspiciousApi> = new Map([
  // === PROCESS INJECTION ===
  ['CreateRemoteThread', { name: 'CreateRemoteThread', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Create thread in remote process', combinations: ['WriteProcessMemory', 'VirtualAllocEx'] }],
  ['CreateRemoteThreadEx', { name: 'CreateRemoteThreadEx', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Extended remote thread creation' }],
  ['NtCreateThreadEx', { name: 'NtCreateThreadEx', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Native API remote thread creation' }],
  ['RtlCreateUserThread', { name: 'RtlCreateUserThread', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Rtl remote thread creation' }],
  ['QueueUserAPC', { name: 'QueueUserAPC', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Queue APC to remote thread' }],
  ['NtQueueApcThread', { name: 'NtQueueApcThread', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Native APC injection' }],
  ['SetThreadContext', { name: 'SetThreadContext', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Modify thread execution context' }],
  ['NtSetContextThread', { name: 'NtSetContextThread', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.DANGEROUS, description: 'Native thread context modification' }],
  
  // === MEMORY MANIPULATION ===
  ['VirtualAllocEx', { name: 'VirtualAllocEx', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Allocate memory in remote process' }],
  ['NtAllocateVirtualMemory', { name: 'NtAllocateVirtualMemory', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Native memory allocation' }],
  ['WriteProcessMemory', { name: 'WriteProcessMemory', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.DANGEROUS, description: 'Write to remote process memory' }],
  ['NtWriteVirtualMemory', { name: 'NtWriteVirtualMemory', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.DANGEROUS, description: 'Native memory write' }],
  ['ReadProcessMemory', { name: 'ReadProcessMemory', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Read remote process memory' }],
  ['NtReadVirtualMemory', { name: 'NtReadVirtualMemory', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Native memory read' }],
  ['VirtualProtect', { name: 'VirtualProtect', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Change memory protection' }],
  ['VirtualProtectEx', { name: 'VirtualProtectEx', behavior: ApiBehavior.MEMORY_MANIPULATION, severity: ThreatLevel.DANGEROUS, description: 'Change remote memory protection' }],
  
  // === PROCESS HOLLOWING ===
  ['NtUnmapViewOfSection', { name: 'NtUnmapViewOfSection', behavior: ApiBehavior.PROCESS_HOLLOWING, severity: ThreatLevel.DANGEROUS, description: 'Unmap process section (hollowing)' }],
  ['ZwUnmapViewOfSection', { name: 'ZwUnmapViewOfSection', behavior: ApiBehavior.PROCESS_HOLLOWING, severity: ThreatLevel.DANGEROUS, description: 'Unmap process section (hollowing)' }],
  
  // === KEYLOGGING ===
  ['GetAsyncKeyState', { name: 'GetAsyncKeyState', behavior: ApiBehavior.KEYLOGGING, severity: ThreatLevel.SUSPICIOUS, description: 'Async keyboard state', combinations: ['GetKeyState'] }],
  ['GetKeyState', { name: 'GetKeyState', behavior: ApiBehavior.KEYLOGGING, severity: ThreatLevel.SUSPICIOUS, description: 'Keyboard key state' }],
  ['GetKeyboardState', { name: 'GetKeyboardState', behavior: ApiBehavior.KEYLOGGING, severity: ThreatLevel.SUSPICIOUS, description: 'Full keyboard state' }],
  ['SetWindowsHookExA', { name: 'SetWindowsHookExA', behavior: ApiBehavior.HOOKING, severity: ThreatLevel.DANGEROUS, description: 'Install system hook (ASCII)' }],
  ['SetWindowsHookExW', { name: 'SetWindowsHookExW', behavior: ApiBehavior.HOOKING, severity: ThreatLevel.DANGEROUS, description: 'Install system hook (Unicode)' }],
  ['RegisterRawInputDevices', { name: 'RegisterRawInputDevices', behavior: ApiBehavior.KEYLOGGING, severity: ThreatLevel.SUSPICIOUS, description: 'Register for raw input' }],
  ['GetRawInputData', { name: 'GetRawInputData', behavior: ApiBehavior.KEYLOGGING, severity: ThreatLevel.SUSPICIOUS, description: 'Get raw input data' }],
  
  // === SCREEN CAPTURE ===
  ['BitBlt', { name: 'BitBlt', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SUSPICIOUS, description: 'Bit-block transfer (screen capture)' }],
  ['GetDC', { name: 'GetDC', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SAFE, description: 'Get device context' }],
  ['GetWindowDC', { name: 'GetWindowDC', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SAFE, description: 'Get window device context' }],
  ['CreateCompatibleBitmap', { name: 'CreateCompatibleBitmap', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SAFE, description: 'Create compatible bitmap' }],
  ['PrintWindow', { name: 'PrintWindow', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SUSPICIOUS, description: 'Print window to DC' }],
  ['capCreateCaptureWindowA', { name: 'capCreateCaptureWindowA', behavior: ApiBehavior.SCREEN_CAPTURE, severity: ThreatLevel.SUSPICIOUS, description: 'Create video capture window' }],
  
  // === NETWORK OPERATIONS ===
  ['InternetOpenA', { name: 'InternetOpenA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Initialize WinINet' }],
  ['InternetOpenW', { name: 'InternetOpenW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Initialize WinINet' }],
  ['InternetOpenUrlA', { name: 'InternetOpenUrlA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Open URL' }],
  ['InternetOpenUrlW', { name: 'InternetOpenUrlW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Open URL' }],
  ['InternetConnectA', { name: 'InternetConnectA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Connect to server' }],
  ['InternetConnectW', { name: 'InternetConnectW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Connect to server' }],
  ['HttpOpenRequestA', { name: 'HttpOpenRequestA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create HTTP request' }],
  ['HttpOpenRequestW', { name: 'HttpOpenRequestW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create HTTP request' }],
  ['HttpSendRequestA', { name: 'HttpSendRequestA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Send HTTP request' }],
  ['HttpSendRequestW', { name: 'HttpSendRequestW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Send HTTP request' }],
  ['URLDownloadToFileA', { name: 'URLDownloadToFileA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.DANGEROUS, description: 'Download file from URL' }],
  ['URLDownloadToFileW', { name: 'URLDownloadToFileW', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.DANGEROUS, description: 'Download file from URL' }],
  ['URLDownloadToCacheFileA', { name: 'URLDownloadToCacheFileA', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.DANGEROUS, description: 'Download to cache' }],
  ['WinHttpOpen', { name: 'WinHttpOpen', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Initialize WinHTTP' }],
  ['WinHttpConnect', { name: 'WinHttpConnect', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'WinHTTP connect' }],
  ['WinHttpSendRequest', { name: 'WinHttpSendRequest', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'WinHTTP send request' }],
  ['socket', { name: 'socket', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Create socket' }],
  ['connect', { name: 'connect', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Connect socket' }],
  ['send', { name: 'send', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Send data' }],
  ['recv', { name: 'recv', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Receive data' }],
  ['WSAStartup', { name: 'WSAStartup', behavior: ApiBehavior.NETWORK_COMMUNICATION, severity: ThreatLevel.SAFE, description: 'Initialize Winsock' }],
  
  // === REGISTRY OPERATIONS ===
  ['RegSetValueExA', { name: 'RegSetValueExA', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Set registry value' }],
  ['RegSetValueExW', { name: 'RegSetValueExW', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Set registry value' }],
  ['RegCreateKeyExA', { name: 'RegCreateKeyExA', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create registry key' }],
  ['RegCreateKeyExW', { name: 'RegCreateKeyExW', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create registry key' }],
  ['RegDeleteKeyA', { name: 'RegDeleteKeyA', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Delete registry key' }],
  ['RegDeleteKeyW', { name: 'RegDeleteKeyW', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Delete registry key' }],
  ['RegDeleteValueA', { name: 'RegDeleteValueA', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Delete registry value' }],
  ['RegDeleteValueW', { name: 'RegDeleteValueW', behavior: ApiBehavior.REGISTRY_MODIFICATION, severity: ThreatLevel.SUSPICIOUS, description: 'Delete registry value' }],
  
  // === CRYPTO OPERATIONS ===
  ['CryptEncrypt', { name: 'CryptEncrypt', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'Encrypt data' }],
  ['CryptDecrypt', { name: 'CryptDecrypt', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'Decrypt data' }],
  ['CryptAcquireContextA', { name: 'CryptAcquireContextA', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SAFE, description: 'Acquire crypto context' }],
  ['CryptAcquireContextW', { name: 'CryptAcquireContextW', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SAFE, description: 'Acquire crypto context' }],
  ['CryptGenKey', { name: 'CryptGenKey', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'Generate crypto key' }],
  ['CryptDeriveKey', { name: 'CryptDeriveKey', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'Derive crypto key' }],
  ['CryptImportKey', { name: 'CryptImportKey', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'Import crypto key' }],
  ['BCryptEncrypt', { name: 'BCryptEncrypt', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'BCrypt encrypt' }],
  ['BCryptDecrypt', { name: 'BCryptDecrypt', behavior: ApiBehavior.CRYPTO_OPERATIONS, severity: ThreatLevel.SUSPICIOUS, description: 'BCrypt decrypt' }],
  
  // === ANTI-DEBUG ===
  ['IsDebuggerPresent', { name: 'IsDebuggerPresent', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SUSPICIOUS, description: 'Check for debugger' }],
  ['CheckRemoteDebuggerPresent', { name: 'CheckRemoteDebuggerPresent', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SUSPICIOUS, description: 'Check remote debugger' }],
  ['NtQueryInformationProcess', { name: 'NtQueryInformationProcess', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SUSPICIOUS, description: 'Query process info (anti-debug)' }],
  ['OutputDebugStringA', { name: 'OutputDebugStringA', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SAFE, description: 'Output debug string' }],
  ['OutputDebugStringW', { name: 'OutputDebugStringW', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SAFE, description: 'Output debug string' }],
  ['NtSetInformationThread', { name: 'NtSetInformationThread', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SUSPICIOUS, description: 'Hide thread from debugger' }],
  ['NtQuerySystemInformation', { name: 'NtQuerySystemInformation', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SUSPICIOUS, description: 'Query system info' }],
  ['GetTickCount', { name: 'GetTickCount', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SAFE, description: 'Timing check' }],
  ['QueryPerformanceCounter', { name: 'QueryPerformanceCounter', behavior: ApiBehavior.ANTI_DEBUG, severity: ThreatLevel.SAFE, description: 'High precision timing' }],
  
  // === PRIVILEGE ESCALATION ===
  ['AdjustTokenPrivileges', { name: 'AdjustTokenPrivileges', behavior: ApiBehavior.PRIVILEGE_ESCALATION, severity: ThreatLevel.DANGEROUS, description: 'Adjust process privileges' }],
  ['OpenProcessToken', { name: 'OpenProcessToken', behavior: ApiBehavior.PRIVILEGE_ESCALATION, severity: ThreatLevel.SUSPICIOUS, description: 'Open process token' }],
  ['LookupPrivilegeValueA', { name: 'LookupPrivilegeValueA', behavior: ApiBehavior.PRIVILEGE_ESCALATION, severity: ThreatLevel.SUSPICIOUS, description: 'Lookup privilege' }],
  ['LookupPrivilegeValueW', { name: 'LookupPrivilegeValueW', behavior: ApiBehavior.PRIVILEGE_ESCALATION, severity: ThreatLevel.SUSPICIOUS, description: 'Lookup privilege' }],
  ['ImpersonateLoggedOnUser', { name: 'ImpersonateLoggedOnUser', behavior: ApiBehavior.USER_IMPERSONATION, severity: ThreatLevel.DANGEROUS, description: 'Impersonate user' }],
  ['DuplicateToken', { name: 'DuplicateToken', behavior: ApiBehavior.USER_IMPERSONATION, severity: ThreatLevel.SUSPICIOUS, description: 'Duplicate token' }],
  ['DuplicateTokenEx', { name: 'DuplicateTokenEx', behavior: ApiBehavior.USER_IMPERSONATION, severity: ThreatLevel.SUSPICIOUS, description: 'Duplicate token extended' }],
  ['SetThreadToken', { name: 'SetThreadToken', behavior: ApiBehavior.USER_IMPERSONATION, severity: ThreatLevel.SUSPICIOUS, description: 'Set thread token' }],
  
  // === SERVICE MANIPULATION ===
  ['CreateServiceA', { name: 'CreateServiceA', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create service' }],
  ['CreateServiceW', { name: 'CreateServiceW', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Create service' }],
  ['OpenServiceA', { name: 'OpenServiceA', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SAFE, description: 'Open service' }],
  ['OpenServiceW', { name: 'OpenServiceW', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SAFE, description: 'Open service' }],
  ['StartServiceA', { name: 'StartServiceA', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Start service' }],
  ['StartServiceW', { name: 'StartServiceW', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Start service' }],
  ['ControlService', { name: 'ControlService', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Control service' }],
  ['DeleteService', { name: 'DeleteService', behavior: ApiBehavior.SERVICE_MANIPULATION, severity: ThreatLevel.SUSPICIOUS, description: 'Delete service' }],
  
  // === DLL INJECTION ===
  ['LoadLibraryA', { name: 'LoadLibraryA', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SAFE, description: 'Load library' }],
  ['LoadLibraryW', { name: 'LoadLibraryW', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SAFE, description: 'Load library' }],
  ['LoadLibraryExA', { name: 'LoadLibraryExA', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SAFE, description: 'Load library extended' }],
  ['LoadLibraryExW', { name: 'LoadLibraryExW', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SAFE, description: 'Load library extended' }],
  ['GetProcAddress', { name: 'GetProcAddress', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SAFE, description: 'Get procedure address' }],
  ['LdrLoadDll', { name: 'LdrLoadDll', behavior: ApiBehavior.DLL_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Native DLL load' }],
  
  // === PROCESS MANIPULATION ===
  ['OpenProcess', { name: 'OpenProcess', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Open process handle' }],
  ['CreateProcessA', { name: 'CreateProcessA', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SAFE, description: 'Create process' }],
  ['CreateProcessW', { name: 'CreateProcessW', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SAFE, description: 'Create process' }],
  ['CreateProcessInternalA', { name: 'CreateProcessInternalA', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Internal process creation' }],
  ['CreateProcessInternalW', { name: 'CreateProcessInternalW', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Internal process creation' }],
  ['TerminateProcess', { name: 'TerminateProcess', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Terminate process' }],
  ['CreateToolhelp32Snapshot', { name: 'CreateToolhelp32Snapshot', behavior: ApiBehavior.SYSTEM_INFORMATION, severity: ThreatLevel.SUSPICIOUS, description: 'Process enumeration' }],
  ['Process32First', { name: 'Process32First', behavior: ApiBehavior.SYSTEM_INFORMATION, severity: ThreatLevel.SUSPICIOUS, description: 'Enumerate first process' }],
  ['Process32Next', { name: 'Process32Next', behavior: ApiBehavior.SYSTEM_INFORMATION, severity: ThreatLevel.SUSPICIOUS, description: 'Enumerate next process' }],
  ['Module32First', { name: 'Module32First', behavior: ApiBehavior.SYSTEM_INFORMATION, severity: ThreatLevel.SUSPICIOUS, description: 'Enumerate first module' }],
  ['Module32Next', { name: 'Module32Next', behavior: ApiBehavior.SYSTEM_INFORMATION, severity: ThreatLevel.SUSPICIOUS, description: 'Enumerate next module' }],
  
  // === CLIPBOARD ===
  ['OpenClipboard', { name: 'OpenClipboard', behavior: ApiBehavior.CLIPBOARD_ACCESS, severity: ThreatLevel.SUSPICIOUS, description: 'Open clipboard' }],
  ['GetClipboardData', { name: 'GetClipboardData', behavior: ApiBehavior.CLIPBOARD_ACCESS, severity: ThreatLevel.SUSPICIOUS, description: 'Get clipboard data' }],
  ['SetClipboardData', { name: 'SetClipboardData', behavior: ApiBehavior.CLIPBOARD_ACCESS, severity: ThreatLevel.SUSPICIOUS, description: 'Set clipboard data' }],
  ['EmptyClipboard', { name: 'EmptyClipboard', behavior: ApiBehavior.CLIPBOARD_ACCESS, severity: ThreatLevel.SUSPICIOUS, description: 'Clear clipboard' }],
  
  // === SHELL EXECUTION ===
  ['ShellExecuteA', { name: 'ShellExecuteA', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Shell execute' }],
  ['ShellExecuteW', { name: 'ShellExecuteW', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Shell execute' }],
  ['ShellExecuteExA', { name: 'ShellExecuteExA', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Shell execute extended' }],
  ['ShellExecuteExW', { name: 'ShellExecuteExW', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'Shell execute extended' }],
  ['WinExec', { name: 'WinExec', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'WinExec command' }],
  ['system', { name: 'system', behavior: ApiBehavior.PROCESS_INJECTION, severity: ThreatLevel.SUSPICIOUS, description: 'CRT system command' }]
]);

/**
 * Behavior patterns that indicate malicious intent
 */
const MALICIOUS_PATTERNS: {
  name: string;
  requiredApis: string[];
  severity: ThreatLevel;
  confidence: number;
  description: string;
}[] = [
  {
    name: 'Process Injection Pattern',
    requiredApis: ['OpenProcess', 'VirtualAllocEx', 'WriteProcessMemory', 'CreateRemoteThread'],
    severity: ThreatLevel.CRITICAL,
    confidence: 95,
    description: 'Classic DLL/shellcode injection pattern detected'
  },
  {
    name: 'Process Hollowing Pattern',
    requiredApis: ['CreateProcessA', 'NtUnmapViewOfSection', 'VirtualAllocEx', 'WriteProcessMemory'],
    severity: ThreatLevel.CRITICAL,
    confidence: 95,
    description: 'Process hollowing technique detected'
  },
  {
    name: 'APC Injection Pattern',
    requiredApis: ['OpenProcess', 'VirtualAllocEx', 'WriteProcessMemory', 'QueueUserAPC'],
    severity: ThreatLevel.CRITICAL,
    confidence: 90,
    description: 'APC-based code injection detected'
  },
  {
    name: 'Keylogger Pattern',
    requiredApis: ['GetAsyncKeyState', 'GetKeyState'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 80,
    description: 'Keylogging capability detected'
  },
  {
    name: 'Hook-based Keylogger',
    requiredApis: ['SetWindowsHookExA', 'GetAsyncKeyState'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 90,
    description: 'Hook-based keylogger detected'
  },
  {
    name: 'Screen Capture Pattern',
    requiredApis: ['GetDC', 'BitBlt', 'CreateCompatibleBitmap'],
    severity: ThreatLevel.SUSPICIOUS,
    confidence: 70,
    description: 'Screen capture capability detected'
  },
  {
    name: 'Credential Theft Pattern',
    requiredApis: ['CryptUnprotectData', 'OpenProcessToken'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 85,
    description: 'Credential theft capability detected'
  },
  {
    name: 'Privilege Escalation Pattern',
    requiredApis: ['OpenProcessToken', 'AdjustTokenPrivileges', 'LookupPrivilegeValueA'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 80,
    description: 'Privilege escalation attempt detected'
  },
  {
    name: 'Service Persistence Pattern',
    requiredApis: ['OpenSCManagerA', 'CreateServiceA', 'StartServiceA'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 75,
    description: 'Service-based persistence mechanism'
  },
  {
    name: 'Download and Execute Pattern',
    requiredApis: ['URLDownloadToFileA', 'ShellExecuteA'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 85,
    description: 'Download and execute dropper pattern'
  },
  {
    name: 'Anti-Debug Evasion',
    requiredApis: ['IsDebuggerPresent', 'CheckRemoteDebuggerPresent', 'NtQueryInformationProcess'],
    severity: ThreatLevel.SUSPICIOUS,
    confidence: 75,
    description: 'Multiple anti-debugging techniques'
  },
  {
    name: 'Process Enumeration',
    requiredApis: ['CreateToolhelp32Snapshot', 'Process32First', 'Process32Next'],
    severity: ThreatLevel.SUSPICIOUS,
    confidence: 60,
    description: 'Process enumeration (reconnaissance)'
  },
  {
    name: 'Ransomware Encryption Pattern',
    requiredApis: ['CryptAcquireContextA', 'CryptGenKey', 'CryptEncrypt', 'FindFirstFileA'],
    severity: ThreatLevel.CRITICAL,
    confidence: 90,
    description: 'File encryption pattern (ransomware)'
  },
  {
    name: 'Clipboard Hijacker',
    requiredApis: ['OpenClipboard', 'GetClipboardData', 'SetClipboardData'],
    severity: ThreatLevel.DANGEROUS,
    confidence: 70,
    description: 'Clipboard manipulation (crypto clipper)'
  }
];

/**
 * Advanced Import Table Analyzer
 */
export class ImportTableAnalyzer {
  
  /**
   * Analyze imports from PE file
   */
  async analyzeFile(filePath: string): Promise<ImportAnalysisResult> {
    try {
      const buffer = await fs.readFile(filePath);
      return this.analyzeBuffer(buffer);
    } catch (error) {
      console.error('Import analysis error:', error);
      return this.createEmptyResult();
    }
  }

  /**
   * Analyze imports from buffer
   */
  analyzeBuffer(buffer: Buffer): ImportAnalysisResult {
    const imports = this.extractImports(buffer);
    return this.analyzeImports(imports);
  }

  /**
   * Extract imports from PE buffer
   */
  private extractImports(buffer: Buffer): { dll: string; functions: string[] }[] {
    const imports: { dll: string; functions: string[] }[] = [];

    try {
      // Check DOS header
      if (buffer.length < 64 || buffer.readUInt16LE(0) !== 0x5A4D) {
        return imports;
      }

      // Get PE header offset
      const peOffset = buffer.readUInt32LE(60);
      if (peOffset + 4 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) {
        return imports;
      }

      // Parse COFF header
      const coffHeaderOffset = peOffset + 4;
      const numberOfSections = buffer.readUInt16LE(coffHeaderOffset + 2);
      const sizeOfOptionalHeader = buffer.readUInt16LE(coffHeaderOffset + 16);

      // Parse Optional Header
      const optionalHeaderOffset = coffHeaderOffset + 20;
      const magic = buffer.readUInt16LE(optionalHeaderOffset);
      const is64Bit = magic === 0x020b;

      // Parse sections
      const sectionTableOffset = optionalHeaderOffset + sizeOfOptionalHeader;
      const sections = this.parseSections(buffer, sectionTableOffset, numberOfSections);

      // Get import directory RVA
      const importDirOffset = optionalHeaderOffset + (is64Bit ? 112 : 96);
      if (importDirOffset + 8 > buffer.length) return imports;

      const importRVA = buffer.readUInt32LE(importDirOffset);
      const importSize = buffer.readUInt32LE(importDirOffset + 4);

      if (importRVA === 0 || importSize === 0) return imports;

      // Convert RVA to file offset
      const importOffset = this.rvaToOffset(importRVA, sections);
      if (importOffset === null) return imports;

      // Parse import descriptors
      let currentOffset = importOffset;
      while (currentOffset + 20 <= buffer.length) {
        const nameRVA = buffer.readUInt32LE(currentOffset + 12);
        if (nameRVA === 0) break;

        const nameOffset = this.rvaToOffset(nameRVA, sections);
        if (nameOffset === null) break;

        // Read DLL name
        let dllName = '';
        let namePos = nameOffset;
        while (namePos < buffer.length) {
          const char = buffer.readUInt8(namePos++);
          if (char === 0) break;
          dllName += String.fromCharCode(char);
        }

        // Parse import names
        const functions: string[] = [];
        const iltRVA = buffer.readUInt32LE(currentOffset);
        
        if (iltRVA !== 0) {
          const iltOffset = this.rvaToOffset(iltRVA, sections);
          if (iltOffset !== null) {
            let thunkOffset = iltOffset;
            const thunkSize = is64Bit ? 8 : 4;

            while (thunkOffset + thunkSize <= buffer.length) {
              const thunk = is64Bit 
                ? Number(buffer.readBigUInt64LE(thunkOffset))
                : buffer.readUInt32LE(thunkOffset);

              if (thunk === 0) break;

              // Check if import by name (not ordinal)
              const ordinalFlag = is64Bit ? 0x8000000000000000n : 0x80000000;
              if ((is64Bit && !(BigInt(thunk) & BigInt(ordinalFlag))) || 
                  (!is64Bit && !(thunk & (ordinalFlag as number)))) {
                const hintOffset = this.rvaToOffset(thunk, sections);
                if (hintOffset !== null && hintOffset + 2 < buffer.length) {
                  // Skip hint (2 bytes), read function name
                  let funcName = '';
                  let funcPos = hintOffset + 2;
                  while (funcPos < buffer.length && funcPos < hintOffset + 256) {
                    const char = buffer.readUInt8(funcPos++);
                    if (char === 0) break;
                    if (char >= 32 && char < 127) {
                      funcName += String.fromCharCode(char);
                    }
                  }
                  if (funcName.length > 0) {
                    functions.push(funcName);
                  }
                }
              }
              thunkOffset += thunkSize;
            }
          }
        }

        if (dllName.length > 0) {
          imports.push({ dll: dllName, functions });
        }

        currentOffset += 20;
      }

    } catch (error) {
      console.error('Import extraction error:', error);
    }

    return imports;
  }

  /**
   * Parse PE sections
   */
  private parseSections(buffer: Buffer, offset: number, count: number): { rva: number; rawOffset: number; rawSize: number }[] {
    const sections: { rva: number; rawOffset: number; rawSize: number }[] = [];

    for (let i = 0; i < count; i++) {
      const sectionOffset = offset + i * 40;
      if (sectionOffset + 40 > buffer.length) break;

      const virtualAddress = buffer.readUInt32LE(sectionOffset + 12);
      const rawSize = buffer.readUInt32LE(sectionOffset + 16);
      const rawOffset = buffer.readUInt32LE(sectionOffset + 20);

      sections.push({ rva: virtualAddress, rawOffset, rawSize });
    }

    return sections;
  }

  /**
   * Convert RVA to file offset
   */
  private rvaToOffset(rva: number, sections: { rva: number; rawOffset: number; rawSize: number }[]): number | null {
    for (const section of sections) {
      if (rva >= section.rva && rva < section.rva + section.rawSize) {
        return rva - section.rva + section.rawOffset;
      }
    }
    return null;
  }

  /**
   * Analyze extracted imports
   */
  private analyzeImports(imports: { dll: string; functions: string[] }[]): ImportAnalysisResult {
    const suspiciousApis: ImportAnalysisResult['suspiciousApis'] = [];
    const allFunctions = new Set<string>();
    let totalFunctions = 0;

    // Collect all functions and identify suspicious ones
    for (const imp of imports) {
      for (const func of imp.functions) {
        totalFunctions++;
        allFunctions.add(func);

        const suspicious = SUSPICIOUS_APIS.get(func);
        if (suspicious && suspicious.severity !== ThreatLevel.SAFE) {
          suspiciousApis.push({
            dll: imp.dll,
            function: func,
            behavior: suspicious.behavior,
            severity: suspicious.severity,
            description: suspicious.description
          });
        }
      }
    }

    // Detect behavior patterns
    const detectedBehaviors = this.detectPatterns(allFunctions);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(suspiciousApis, detectedBehaviors);

    // Generate assessment
    const assessment = this.generateAssessment(suspiciousApis, detectedBehaviors, riskScore);

    return {
      totalImports: totalFunctions,
      totalDlls: imports.length,
      imports: imports.map(imp => ({
        dll: imp.dll,
        functions: imp.functions,
        isSuspicious: imp.functions.some(f => {
          const api = SUSPICIOUS_APIS.get(f);
          return api && api.severity !== ThreatLevel.SAFE;
        })
      })),
      suspiciousApis,
      detectedBehaviors,
      riskScore,
      assessment
    };
  }

  /**
   * Detect malicious patterns
   */
  private detectPatterns(functions: Set<string>): ImportAnalysisResult['detectedBehaviors'] {
    const detected: ImportAnalysisResult['detectedBehaviors'] = [];

    for (const pattern of MALICIOUS_PATTERNS) {
      const matchedApis = pattern.requiredApis.filter(api => {
        // Check exact match or variants (A/W suffix)
        return functions.has(api) || 
               functions.has(api + 'A') || 
               functions.has(api + 'W') ||
               functions.has(api.replace(/[AW]$/, ''));
      });

      const matchRatio = matchedApis.length / pattern.requiredApis.length;

      // Require at least 75% match for patterns
      if (matchRatio >= 0.75) {
        // Infer behavior from pattern
        let behavior = ApiBehavior.PROCESS_INJECTION;
        if (pattern.name.toLowerCase().includes('keylog')) behavior = ApiBehavior.KEYLOGGING;
        else if (pattern.name.toLowerCase().includes('screen')) behavior = ApiBehavior.SCREEN_CAPTURE;
        else if (pattern.name.toLowerCase().includes('hollow')) behavior = ApiBehavior.PROCESS_HOLLOWING;
        else if (pattern.name.toLowerCase().includes('priv')) behavior = ApiBehavior.PRIVILEGE_ESCALATION;
        else if (pattern.name.toLowerCase().includes('persist') || pattern.name.toLowerCase().includes('service')) behavior = ApiBehavior.PERSISTENCE;
        else if (pattern.name.toLowerCase().includes('debug')) behavior = ApiBehavior.ANTI_DEBUG;
        else if (pattern.name.toLowerCase().includes('ransom') || pattern.name.toLowerCase().includes('encrypt')) behavior = ApiBehavior.CRYPTO_OPERATIONS;

        detected.push({
          behavior,
          apis: matchedApis,
          severity: pattern.severity,
          confidence: Math.round(pattern.confidence * matchRatio),
          description: pattern.description
        });
      }
    }

    return detected;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(
    suspiciousApis: ImportAnalysisResult['suspiciousApis'],
    patterns: ImportAnalysisResult['detectedBehaviors']
  ): number {
    let score = 0;

    // Score from suspicious APIs
    for (const api of suspiciousApis) {
      switch (api.severity) {
        case ThreatLevel.CRITICAL: score += 15; break;
        case ThreatLevel.DANGEROUS: score += 10; break;
        case ThreatLevel.SUSPICIOUS: score += 5; break;
      }
    }

    // Score from detected patterns (weighted more heavily)
    for (const pattern of patterns) {
      switch (pattern.severity) {
        case ThreatLevel.CRITICAL: score += 30; break;
        case ThreatLevel.DANGEROUS: score += 20; break;
        case ThreatLevel.SUSPICIOUS: score += 10; break;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Generate human-readable assessment
   */
  private generateAssessment(
    suspiciousApis: ImportAnalysisResult['suspiciousApis'],
    patterns: ImportAnalysisResult['detectedBehaviors'],
    riskScore: number
  ): string {
    if (riskScore >= 80) {
      return 'CRITICAL: High-confidence malicious patterns detected. Multiple dangerous API combinations found.';
    }
    if (riskScore >= 60) {
      return 'DANGEROUS: Suspicious API patterns detected. File may contain malicious functionality.';
    }
    if (riskScore >= 40) {
      return 'SUSPICIOUS: Some concerning APIs present. Further analysis recommended.';
    }
    if (riskScore >= 20) {
      return 'LOW RISK: Minor suspicious APIs detected. Likely benign but verify source.';
    }
    return 'CLEAN: No significant suspicious API usage detected.';
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): ImportAnalysisResult {
    return {
      totalImports: 0,
      totalDlls: 0,
      imports: [],
      suspiciousApis: [],
      detectedBehaviors: [],
      riskScore: 0,
      assessment: 'Unable to analyze imports'
    };
  }
}

// Export singleton
export const importTableAnalyzer = new ImportTableAnalyzer();
