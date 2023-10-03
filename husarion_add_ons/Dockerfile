# URDF stage
FROM husarion/rviz2:humble-nightly as urdf_builder

RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-vcstool \
    git && \
    git clone -b ros2-control https://github.com/husarion/panther_ros.git /ros2_ws/src/panther_ros && \
    rm -rf /ros2_ws/src/panther_ros/panther && \
    rm -rf /ros2_ws/src/panther_ros/panther_battery && \
    rm -rf /ros2_ws/src/panther_ros/panther_controller && \
    rm -rf /ros2_ws/src/panther_ros/panther_hardware_interfaces && \
    rm -rf /ros2_ws/src/panther_ros/panther_utils && \
    cd /ros2_ws && \
    source install/setup.bash && \
    colcon build

RUN apt-get update -y && apt-get install -y ros-$ROS_DISTRO-xacro && \
    source install/setup.bash && \
    xacro /ros2_ws/src/rosbot_ros/rosbot_description/urdf/rosbot.urdf.xacro > /rosbot.urdf && \
    xacro /ros2_ws/src/rosbot_xl_ros/rosbot_xl_description/urdf/rosbot_xl.urdf.xacro use_sim:=false simulation_controllers_config_file:=None > /rosbot_xl.urdf && \
    xacro /ros2_ws/src/panther_ros/panther_description/urdf/panther.urdf.xacro > /panther.urdf && \
    # Changing rotation is cause by .stl files in rosbot_ros/rosbot_description. We will change it to the .dae files.
    sed -i 's/rpy=\"1.5707963267948966 0.0 1.5707963267948966\"/rpy=\"0.0 0.0 1.5707963267948966\"/g' /rosbot.urdf

# Build stage
FROM node:16 as build
WORKDIR /src
COPY . ./

RUN corepack enable
RUN yarn install --immutable

RUN yarn run web:build:prod

# Release stage
FROM caddy:2.5.2-alpine

RUN apk update && apk add bash

WORKDIR /src
COPY --from=build /src/web/.webpack ./

COPY husarion_add_ons/FoxgloveDefaultLayout.json /foxglove/default-layout.json
COPY husarion_add_ons/default-url.txt .

COPY husarion_add_ons/Caddyfile /etc/caddy/

# copy URDFs
COPY --from=urdf_builder /ros2_ws ./ros2_ws
COPY --from=urdf_builder /rosbot.urdf .
COPY --from=urdf_builder /rosbot_xl.urdf .
COPY --from=urdf_builder /panther.urdf .

EXPOSE 8080


ENV FOXGLOVE_PORT=8080
ENV ROSBRIDGE_PORT=9090

# replace file:///ros2_ws with http://{{.Host}}:FOXGLOVE_PORT/ros2_ws in /src/rosbot_xl.urdf and /src/rosbot.urdf files
RUN sed -i 's|file:///ros2_ws|http://{{.Host}}:{{env "FOXGLOVE_PORT"}}/ros2_ws|g' /src/rosbot_xl.urdf /src/rosbot.urdf /src/panther.urdf

# replace localhost:8080 with {{.Host}}:FOXGLOVE_PORT in /src/FoxgloveDefaultLayout.json file
RUN sed -i 's|localhost:8080|{{.Host}}:{{env "FOXGLOVE_PORT"}}|g' /foxglove/default-layout.json

COPY <<EOF /entrypoint.sh
# Optionally override the default layout with one provided via bind mount
mkdir -p /foxglove
touch /foxglove/default-layout.json
index_html=\$(cat index.html)
replace_pattern='/*FOXGLOVE_STUDIO_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=\$(cat /foxglove/default-layout.json)
echo "\${index_html/"\$replace_pattern"/\$replace_value}" > index.html

# Continue executing the CMD
exec "\$@"
EOF




ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
# CMD ["caddy", "file-server", "--listen", ":8080"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
