#!/usr/bin/env bash
set -euo pipefail

# Generate logos for all QuickSuite modules via Replicate API
# Uses the existing Q logo as style reference

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
QUICKLOTZ_DIR="$(cd "${REPO_DIR}/.." && pwd)"

STYLE_REF="/Users/connorodea/Downloads/QL-Q.jpg"
REPLICATE_API_TOKEN="${REPLICATE_API_TOKEN:-}"

if [[ -z "${REPLICATE_API_TOKEN}" ]]; then
  echo "ERROR: REPLICATE_API_TOKEN environment variable not set"
  echo "  export REPLICATE_API_TOKEN=r8_..."
  exit 1
fi

if [[ ! -f "${STYLE_REF}" ]]; then
  echo "WARNING: Style reference not found at ${STYLE_REF}"
  echo "Will generate logos without style reference"
fi

# Module definitions: DIR_NAME|LOGO_TEXT|DISPLAY_NAME
MODULES=(
  "quicktestz|QTest|QuickTestz"
  "quickrefurbz|QRefurb|QuickRefurbz"
  "quick3plz|Q3PL|Quick3PLz"
  "quickalertz|QAlert|QuickAlertz"
  "quickauthz|QAuth|QuickAuthz"
  "quickbidz|QBid|QuickBidz"
  "quickconsignmentz|QConsign|QuickConsignmentz"
  "quickcyclez|QCycle|QuickCyclez"
  "quickdiscardz|QDiscard|QuickDiscardz"
  "quickfinancez|QFinance|QuickFinancez"
  "quickfulfillment|QFulfill|QuickFulfillment"
  "quickinsightz|QInsight|QuickInsightz"
  "quickinventoryz|QInventory|QuickInventoryz"
  "quickloadz|QLoad|QuickLoadz"
  "quickmarketsync|QMarket|QuickMarketSync"
  "quickpartz|QPart|QuickPartz"
  "quickrecyclez|QRecycle|QuickRecyclez"
  "quicksalvage|QSalvage|QuickSalvage"
  "quickshipz|QShip|QuickShipz"
  "quicksupplyz|QSupply|QuickSupplyz"
  "quicktaskz|QTask|QuickTaskz"
  "quickintakez|QIntake|Quickintakez"
  "quickscanz|QScan|Quickscanz"
  "quickauctionz|QAuction|QuickAuctionz"
  "quickgradez|QGrade|QuickGradez"
  "quicklistz|QList|QuickListz"
  "quickmanifestz|QManifest|QuickManifestz"
  "quickpalletz|QPallet|QuickPalletz"
  "quickreturnz|QReturn|QuickReturnz"
)

upload_to_replicate() {
  local file_path="$1"
  local base64_data
  base64_data=$(base64 < "${file_path}")
  local mime_type="image/jpeg"
  local data_uri="data:${mime_type};base64,${base64_data}"
  echo "${data_uri}"
}

generate_logo() {
  local dir_name="$1"
  local logo_text="$2"
  local display_name="$3"

  local install_page_dir="${QUICKLOTZ_DIR}/install-pages/${dir_name}"
  mkdir -p "${install_page_dir}"

  local output_file="${install_page_dir}/logo-1024.png"

  if [[ -f "${output_file}" ]]; then
    echo "  SKIP: ${output_file} already exists"
    return 0
  fi

  echo "  Generating logo for ${display_name} (${logo_text})..."

  local prompt="Gold metallic text '${logo_text}' on black circular background, matching style of reference logo, clean professional app icon design, 1024x1024, luxury gold lettering, minimalist, centered text"

  # Create prediction via Replicate API (using SDXL)
  local response
  response=$(curl -s -X POST "https://api.replicate.com/v1/predictions" \
    -H "Authorization: Bearer ${REPLICATE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"version\": \"39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b\",
      \"input\": {
        \"prompt\": \"${prompt}\",
        \"width\": 1024,
        \"height\": 1024,
        \"num_outputs\": 1,
        \"scheduler\": \"K_EULER\",
        \"num_inference_steps\": 50,
        \"guidance_scale\": 7.5
      }
    }")

  local prediction_id
  prediction_id=$(echo "${response}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if [[ -z "${prediction_id}" ]]; then
    echo "  ERROR: Failed to create prediction for ${display_name}"
    echo "  Response: ${response}"
    return 1
  fi

  echo "  Prediction ID: ${prediction_id}, waiting..."

  # Poll for completion
  local status="starting"
  local result_url=""
  for i in $(seq 1 60); do
    sleep 3
    local poll_response
    poll_response=$(curl -s "https://api.replicate.com/v1/predictions/${prediction_id}" \
      -H "Authorization: Bearer ${REPLICATE_API_TOKEN}")

    status=$(echo "${poll_response}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")

    if [[ "${status}" == "succeeded" ]]; then
      result_url=$(echo "${poll_response}" | python3 -c "import sys,json; o=json.load(sys.stdin).get('output',[]); print(o[0] if o else '')" 2>/dev/null || echo "")
      break
    elif [[ "${status}" == "failed" || "${status}" == "canceled" ]]; then
      echo "  ERROR: Prediction ${status} for ${display_name}"
      return 1
    fi
  done

  if [[ -z "${result_url}" ]]; then
    echo "  ERROR: Timed out waiting for ${display_name}"
    return 1
  fi

  # Download the result
  curl -fsSL "${result_url}" -o "${output_file}"
  echo "  DONE: ${output_file}"
}

convert_icons() {
  local dir_name="$1"
  local display_name="$2"
  local install_page_dir="${QUICKLOTZ_DIR}/install-pages/${dir_name}"
  local source="${install_page_dir}/logo-1024.png"

  if [[ ! -f "${source}" ]]; then
    echo "  SKIP: No source logo for ${display_name}"
    return 0
  fi

  # Create 80px web version
  if command -v sips >/dev/null 2>&1; then
    local web_icon="${install_page_dir}/logo-80.png"
    if [[ ! -f "${web_icon}" ]]; then
      sips -z 80 80 "${source}" --out "${web_icon}" >/dev/null 2>&1
      echo "  Created 80px: ${web_icon}"
    fi
  fi

  # Create .icns (macOS)
  if command -v iconutil >/dev/null 2>&1; then
    local icns_file="${install_page_dir}/icon.icns"
    if [[ ! -f "${icns_file}" ]]; then
      local iconset_dir
      iconset_dir=$(mktemp -d)/icon.iconset
      mkdir -p "${iconset_dir}"

      local sizes=(16 32 64 128 256 512 1024)
      for size in "${sizes[@]}"; do
        sips -z "${size}" "${size}" "${source}" --out "${iconset_dir}/icon_${size}x${size}.png" >/dev/null 2>&1
      done
      # Retina icons
      sips -z 32 32 "${source}" --out "${iconset_dir}/icon_16x16@2x.png" >/dev/null 2>&1
      sips -z 64 64 "${source}" --out "${iconset_dir}/icon_32x32@2x.png" >/dev/null 2>&1
      sips -z 128 128 "${source}" --out "${iconset_dir}/icon_64x64@2x.png" >/dev/null 2>&1 || true
      sips -z 256 256 "${source}" --out "${iconset_dir}/icon_128x128@2x.png" >/dev/null 2>&1
      sips -z 512 512 "${source}" --out "${iconset_dir}/icon_256x256@2x.png" >/dev/null 2>&1
      sips -z 1024 1024 "${source}" --out "${iconset_dir}/icon_512x512@2x.png" >/dev/null 2>&1

      iconutil -c icns "${iconset_dir}" -o "${icns_file}" 2>/dev/null || true
      rm -rf "$(dirname "${iconset_dir}")"
      if [[ -f "${icns_file}" ]]; then
        echo "  Created icns: ${icns_file}"
      fi
    fi
  fi

  # Create .ico (Windows) via sips + ImageMagick if available
  local ico_file="${install_page_dir}/icon.ico"
  if [[ ! -f "${ico_file}" ]]; then
    if command -v convert >/dev/null 2>&1; then
      convert "${source}" -resize 256x256 "${ico_file}" 2>/dev/null || true
      if [[ -f "${ico_file}" ]]; then
        echo "  Created ico: ${ico_file}"
      fi
    elif command -v magick >/dev/null 2>&1; then
      magick "${source}" -resize 256x256 "${ico_file}" 2>/dev/null || true
      if [[ -f "${ico_file}" ]]; then
        echo "  Created ico: ${ico_file}"
      fi
    else
      echo "  SKIP: ImageMagick not available for .ico generation"
    fi
  fi

  # Copy to module's assets dir if it exists
  local module_dir=""
  case "${dir_name}" in
    quicktestz)     module_dir="${QUICKLOTZ_DIR}/QuickRefurbz" ;;
    quickrefurbz)   module_dir="${QUICKLOTZ_DIR}/QuickRefurbz" ;;
    quick3plz)      module_dir="${QUICKLOTZ_DIR}/Quick3PLz" ;;
    quickalertz)    module_dir="${QUICKLOTZ_DIR}/QuickAlertz" ;;
    quickauthz)     module_dir="${QUICKLOTZ_DIR}/QuickAuthz" ;;
    quickbidz)      module_dir="${QUICKLOTZ_DIR}/QuickBidz" ;;
    quickconsignmentz) module_dir="${QUICKLOTZ_DIR}/QuickConsignmentz" ;;
    quickcyclez)    module_dir="${QUICKLOTZ_DIR}/QuickCyclez" ;;
    quickdiscardz)  module_dir="${QUICKLOTZ_DIR}/QuickDiscardz" ;;
    quickfinancez)  module_dir="${QUICKLOTZ_DIR}/QuickFinancez" ;;
    quickfulfillment) module_dir="${QUICKLOTZ_DIR}/QuickFulfillment" ;;
    quickinsightz)  module_dir="${QUICKLOTZ_DIR}/QuickInsightz" ;;
    quickinventoryz) module_dir="${QUICKLOTZ_DIR}/QuickInventoryz" ;;
    quickloadz)     module_dir="${QUICKLOTZ_DIR}/QuickLoadz" ;;
    quickmarketsync) module_dir="${QUICKLOTZ_DIR}/QuickMarketSync" ;;
    quickpartz)     module_dir="${QUICKLOTZ_DIR}/QuickPartz" ;;
    quickrecyclez)  module_dir="${QUICKLOTZ_DIR}/QuickRecyclez" ;;
    quicksalvage)   module_dir="${QUICKLOTZ_DIR}/QuickSalvage" ;;
    quickshipz)     module_dir="${QUICKLOTZ_DIR}/QuickShipz" ;;
    quicksupplyz)   module_dir="${QUICKLOTZ_DIR}/QuickSupplyz" ;;
    quicktaskz)     module_dir="${QUICKLOTZ_DIR}/QuickTaskz" ;;
    quickintakez)   module_dir="${QUICKLOTZ_DIR}/Quickintakez" ;;
    quickscanz)     module_dir="${QUICKLOTZ_DIR}/Quickscanz" ;;
    quickauctionz)  module_dir="${QUICKLOTZ_DIR}/QuickAuctionz" ;;
    quickgradez)    module_dir="${QUICKLOTZ_DIR}/QuickGradez" ;;
    quicklistz)     module_dir="${QUICKLOTZ_DIR}/Quicklistz" ;;
    quickmanifestz) module_dir="${QUICKLOTZ_DIR}/Quickmanifestz" ;;
    quickpalletz)   module_dir="${QUICKLOTZ_DIR}/QuickPalletz" ;;
    quickreturnz)   module_dir="${QUICKLOTZ_DIR}/QuickReturnz" ;;
  esac

  if [[ -n "${module_dir}" && -d "${module_dir}" ]]; then
    mkdir -p "${module_dir}/assets"
    cp "${source}" "${module_dir}/assets/logo-1024.png" 2>/dev/null || true
    if [[ -f "${install_page_dir}/icon.icns" ]]; then
      cp "${install_page_dir}/icon.icns" "${module_dir}/assets/icon.icns" 2>/dev/null || true
    fi
    if [[ -f "${install_page_dir}/icon.ico" ]]; then
      cp "${install_page_dir}/icon.ico" "${module_dir}/assets/icon.ico" 2>/dev/null || true
    fi
    echo "  Copied assets to ${module_dir}/assets/"
  fi
}

echo "==========================================="
echo " QuickSuite Logo Generator"
echo " ${#MODULES[@]} modules to process"
echo "==========================================="
echo ""

MODE="${1:-generate}"

if [[ "${MODE}" == "generate" ]]; then
  echo "Phase 1: Generating logos via Replicate API"
  echo "-------------------------------------------"
  for module in "${MODULES[@]}"; do
    IFS='|' read -r dir_name logo_text display_name <<< "${module}"
    generate_logo "${dir_name}" "${logo_text}" "${display_name}" || true
  done
fi

echo ""
echo "Phase 2: Converting to .icns, .ico, and 80px web"
echo "-------------------------------------------------"
for module in "${MODULES[@]}"; do
  IFS='|' read -r dir_name logo_text display_name <<< "${module}"
  convert_icons "${dir_name}" "${display_name}" || true
done

echo ""
echo "Done! Logo generation complete."
echo "Run with 'convert' argument to skip generation and only convert:"
echo "  $0 convert"
