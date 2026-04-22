/**
 * Common XSS payloads for penetration testing.
 * Each payload targets a different XSS vector.
 */
export const XSS_PAYLOADS = {
  scriptTag: '<script>window.__xss_fired=true</script>',
  imgOnerror: '<img src=x onerror="window.__xss_fired=true">',
  svgOnload: '<svg onload="window.__xss_fired=true">',
  iframeJs: '<iframe src="javascript:parent.__xss_fired=true">',
  divEvent: '<div onmouseover="window.__xss_fired=true">hover me</div>',
  bodyOnload: '<body onload="window.__xss_fired=true">',
  inputAutofocus: '<input autofocus onfocus="window.__xss_fired=true">',
  marqueOnstart: '<marquee onstart="window.__xss_fired=true">',
  detailsOpen: '<details open ontoggle="window.__xss_fired=true"><summary>x</summary></details>',
  aHrefJs: '<a href="javascript:window.__xss_fired=true">click</a>',
};

/**
 * SQL injection payloads for testing.
 */
export const SQL_PAYLOADS = [
  "'; DROP TABLE words;--",
  "' OR '1'='1",
  "1; SELECT * FROM information_schema.tables--",
  "' UNION SELECT null,null,null,null--",
  "1' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--",
];

/**
 * Path traversal payloads.
 */
export const PATH_TRAVERSAL_PAYLOADS = [
  '../../etc/passwd',
  '..\\..\\windows\\system32\\config\\sam',
  '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  '....//....//etc/passwd',
];

/**
 * CRLF injection payloads.
 */
export const CRLF_PAYLOADS = [
  'test%0d%0aInjected-Header:true',
  'test\r\nSet-Cookie:hacked=true',
  'test%0aContent-Type:text/html',
];
