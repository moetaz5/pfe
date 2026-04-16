allprojects {
    repositories {
        google()
        mavenCentral()
    }
    if (System.getProperty("os.name").lowercase().contains("windows") && file("C:/medica_combined_build").exists()) {
        buildDir = file("C:/medica_combined_build/${project.name}")
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(layout.buildDirectory)
}
