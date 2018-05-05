
#define roadLaneCount 3.0
#define roadLaneWidth 4.2
#define roadPaddingWidth 2.0

#define postWidth 0.15
#define postHeight 8.1
#define postRadius 2.1
#define postStem 0.45
#define postOffset 7.5
#define postLightWidth 2.4
#define postLightHeight 0.3
#define postLightColor vec3(1.0, 0.9, 0.4)

#define lightSpacing 100.0
#define lightOffset 5.0

// fence spacing should fit evenly within light spacing
#define fenceSpacing 12.5
#define fenceHeight 2.5
#define fenceXOffset 9.5

#define buildingSpacing 25
#define buildingHeight 30
#define buildingXOffset 18

void roadSettings() {}

#pragma glslify: export(roadSettings)

