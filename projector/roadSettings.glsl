
#define roadLaneWidth 4.2
#define roadShoulderWidth 4.0
#define roadMarkerWidth 0.25
#define roadLaneMarkerLength 6.0

#define postWidth 0.15
#define postHeight 8.1
#define postRadius 2.1
#define postStem 0.45
#define postOffset 8.0
#define postLightWidth 2.4
#define postLightHeight 0.3
#define postLightColor vec3(1.0, 0.9, 0.4)

#define lightSpacing 100.0
#define lightOffset 5.0

// fence spacing should fit evenly within light spacing
#define fenceSpacing 12.5
#define fenceHeight 2.5
#define fenceXOffset 10.5

#define buildingSpacing 25
#define buildingHeight 30
#define buildingXOffset 18

void roadSettings() {}

#pragma glslify: export(roadSettings)

