/** Capability registry. USB status is verified; historical validation is not a new physical cut test. */
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const CAMEO4 = freeze({
  id: 'cameo4-usbprint-a4',
  label: 'CAMEO 4 · USB · A4 paisagem',
  liveTransport: true,
  implementationStatus: 'usb-status-verified-cut-test-pending',
  provenance: {
    historicalValidationDeclared: true,
    source: 'CAMEO 4 Windows USBPRINT backend by Eron Greco',
    backendSha256: 'ba1341e9c4dcfb18c661778ccfc53ba8fb9bb808b05304b42426f9f28b7153bb',
    declaredValidationDate: '2026-09-17',
    declaredFirmware: 'V1.20',
    currentImplementationPhysicallyValidated: false,
  },
  transport: { kind: 'windows-usbprint', platform: 'win32', vendorId: 0x0b4d, productId: 0x1137,
    interfaceGuid: '{28d78fad-5a12-11d1-ae5b-0000f803a8c2}', exclusive: true, persistentOverlappedReader: true },
  protocol: { unitsPerMm: 20, coordinateOrder: 'Y,X', terminator: 3, originMm: [10, 10],
    quantization: 'IEEE-754 multiplication followed by round-half-to-even (Python round)',
    pathCommands: ['M', 'D'], arbitraryPathsStatus: 'integrated-physical-cut-test-pending', overcutSupported: true,overcutMode:'software-sharp-corner-segments' },
  registration: { pageWidthMm: 297, pageHeightMm: 210, insetMm: 10, squareMm: 5, armMm: 10,
    thicknessMm: 1, spacingMm: [277, 190], whiteBorderRangeMm: [0, 10],
    block1: 'TG1\x03FN0\x03TB50,0\x03TB99\x03',
    block2: 'TB52,2\x03TB51,200\x03TB53,20\x03TB55,1\x03TB123,3800,5540,118,118\x03TB99\x03',
    delayBetweenBlocksMs: 108, firstPollMs: 526, pollPeriodMs: 1015, timeoutMs: 35000,
    statusQuery: '\x1b\x05', successResponse: '    0\x03', finalReadyResponse: '0\x03' },
  tools: { holder: 1, type: 'AutoBlade', depth: [1, 10], force: [1, 33], speed: [1, 10], passes: [1, 5] },
  limits: { sheetsPerJob: 1, pathsPerJob: 200, pointsPerPath: 2000, pointsPerJob: 20000,
    maxBodyBytes: 1000000, maxTravelMm: 250000 },
});

/** Returns a deeply frozen profile; unknown models are never inferred as compatible. */
export function getDeviceProfile(id = CAMEO4.id) {
  if (id !== CAMEO4.id) throw new Error('Perfil de máquina não comprovado: ' + String(id));
  return CAMEO4;
}

export const DEVICE_PROFILE_IDS = Object.freeze([CAMEO4.id]);
