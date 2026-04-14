allprojects {
    repositories {
        google()
        mavenCentral()
    }
    buildDir = file("C:/medica_combined_build/${project.name}")
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(layout.buildDirectory)
}
