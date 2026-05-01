import Image from 'next/image'

const folderStyles = `
  .cls-1 {
    fill: #ea9719;
    stroke: #1a1a1a;
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .cls-2 {
    fill: #231f20;
    stroke: #fff;
    stroke-miterlimit: 10;
    stroke-width: 7px;
  }
  .cls-2-outer {
    fill: none;
    stroke: #1a1a1a;
    stroke-width: 15px;
  }
  .cls-3 {
    fill: #fdb813;
    stroke: #1a1a1a;
    stroke-width: 4px;
    stroke-linejoin: round;
  }
`

const FOLDER_VIEWBOX = '186 116 567 386'

export default function WebsterFolder() {
  return (
    <div className="group relative inline-block" style={{ paddingTop: 130 }}>
      {/* Folder Back */}
      <div className="absolute inset-x-0 z-10" style={{ top: 130 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={FOLDER_VIEWBOX}
          style={{ width: 320, height: 218, display: 'block', overflow: 'visible' }}
        >
          <defs>
            <style>{folderStyles}</style>
          </defs>
          <g>
            <path
              className="cls-1"
              d="M405.85,235.11h-167.82c-24.35,0-44.1-19.74-44.1-44.1v-66.33c0-24.35,19.74-44.1,44.1-44.1h108.3c3.65.3,8.9,1.16,14.75,3.63,6.53,2.76,11.15,6.41,13.98,9.03,15.74,11.78,31.48,23.55,47.23,35.33,92.15.31,184.31.63,276.46.94,2.81-.21,21.49-1.27,35.2,12.93,8.58,8.89,10.77,19.17,11.43,23.37-.07,12.7-.14,25.4-.2,38.1-85.66-17.62-195.76-23.77-308.15,18.29-10.76,4.03-21.15,8.35-31.18,12.92h0Z"
            />
            <rect
              className="cls-3"
              x="193.94"
              y="164.01"
              width="551.45"
              height="329.72"
              rx="28.2"
              ry="28.2"
            />
          </g>
        </svg>
      </div>

      {/* Webster */}
      <div
        className="absolute z-20"
        style={{ top: 0, left: '50%', transform: 'translateX(-20%) translateY(20%)' }}
      >
        <div className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-12">
          <Image src="/webster.png" alt="Webster" width={200} height={290} />
        </div>
      </div>

      {/* Folder Front */}
      <div className="absolute inset-x-0 z-30" style={{ top: 130 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={FOLDER_VIEWBOX}
          style={{ width: 320, height: 218, display: 'block', overflow: 'visible' }}
        >
          <defs>
            <style>{folderStyles}</style>
          </defs>
          <g>
            <rect
              className="cls-3"
              x="193.94"
              y="164.01"
              width="551.45"
              height="329.72"
              rx="28.2"
              ry="28.2"
            />
            <g transform="translate(150, 0)">
              <path
                className="cls-2-outer"
                d="M7.33,321.33c27.87-19.37,55.74-38.73,83.61-58.1-4.95,35.61-9.9,71.22-14.85,106.83-6.48-7.36-12.96-14.73-19.44-22.09-8.29,15.52-16.58,31.04-24.87,46.55-6.83-4.38-13.66-8.77-20.48-13.15,8.95-15.9,17.9-31.81,26.85-47.71-10.27-4.11-20.55-8.22-30.82-12.33Z"
              />
              <path
                className="cls-2"
                d="M7.33,321.33c27.87-19.37,55.74-38.73,83.61-58.1-4.95,35.61-9.9,71.22-14.85,106.83-6.48-7.36-12.96-14.73-19.44-22.09-8.29,15.52-16.58,31.04-24.87,46.55-6.83-4.38-13.66-8.77-20.48-13.15,8.95-15.9,17.9-31.81,26.85-47.71-10.27-4.11-20.55-8.22-30.82-12.33Z"
              />
            </g>
          </g>
        </svg>
      </div>

      <div style={{ width: 320, height: 218 }} />
    </div>
  )
}
